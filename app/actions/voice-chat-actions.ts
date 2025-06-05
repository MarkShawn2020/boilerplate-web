'use server';

import { logger } from '@/services/logger';
import { Signer } from '@volcengine/openapi';

const CONVERSATION_SIGNATURE = 'conversation';

/**
 * StartVoiceChat 请求参数
 */
interface StartVoiceChatRequest {
  appId: string;
  roomId: string;
  personaId: string;
  userId: string;
}

/**
 * 停止智能体请求参数
 */
interface StopVoiceChatRequest {
  TaskId: string;
}

/**
 * 火山引擎账户信息
 * 参考 https://console.volcengine.com/iam/keymanage/ 获取 AK/SK
 */
const ACCOUNT_INFO = {
  accessKeyId: process.env.AK || '',
  secretKey: process.env.SK || '',
};

// 验证关键配置
if (!ACCOUNT_INFO.accessKeyId || !ACCOUNT_INFO.secretKey) {
  logger.error('缺少必要的认证信息: AK 或 SK 未在环境变量中找到');
}

/**
 * 调用火山引擎 OpenAPI 的通用方法
 */
async function callVolcEngineAPI(
  action: string,
  version: string,
  body: Record<string, any>
): Promise<any> {
  logger.info(`调用火山引擎 API: ${action}`, { body });

  try {
    /**
     * 参考 https://github.com/volcengine/volc-sdk-nodejs 获取更多火山 TOP 网关 SDK 的使用方式
     */
    const openApiRequestData = {
      region: 'cn-north-1',
      method: 'POST',
      params: {
        Action: action,
        Version: version,
      },
      headers: {
        Host: 'rtc.volcengineapi.com',
        'Content-type': 'application/json',
      },
      body,
    };

    logger.debug('签名 OpenAPI 请求', { region: openApiRequestData.region });
    const signer = new Signer(openApiRequestData, 'rtc');
    signer.addAuthorization(ACCOUNT_INFO);

    logger.info('发起火山引擎 OpenAPI 请求', {
      action,
      version,
      url: `https://rtc.volcengineapi.com?Action=${action}&Version=${version}`,
    });

    /** 参考 https://www.volcengine.com/docs/6348/69828 获取更多 OpenAPI 信息 */
    const response = await fetch(
      `https://rtc.volcengineapi.com?Action=${action}&Version=${version}`,
      {
        method: 'POST',
        headers: openApiRequestData.headers,
        body: JSON.stringify(body),
      }
    );

    const volcResponse = await response.json();
    logger.info('火山引擎 API 响应', volcResponse);

    if (response.ok && volcResponse.ResponseMetadata?.Error?.Code) {
      logger.warn('火山引擎 API 返回错误', {
        errorCode: volcResponse.ResponseMetadata.Error.Code,
        errorMessage: volcResponse.ResponseMetadata.Error.Message,
      });
      throw new Error(`火山引擎 API 错误: ${volcResponse.ResponseMetadata.Error.Message}`);
    }

    if (!response.ok) {
      logger.error('火山引擎 API 请求失败', {
        status: response.status,
        statusText: response.statusText,
        response: volcResponse,
      });
      throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
    }

    return volcResponse;
  } catch (error) {
    logger.error('调用火山引擎 API 异常:', error);
    throw error;
  }
}

/**
 * 启动智能体 Server Action
 */
export async function startVoiceChatAction(request: StartVoiceChatRequest): Promise<{
  success: boolean;
  taskId?: string;
  error?: string;
}> {
  try {
    logger.info('Server Action: 启动智能体', request);

    // 生成唯一任务ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 构造 StartVoiceChat API 请求参数
    const apiParams = {
      AppId: process.env.NEXT_PUBLIC_RTC_APP_ID || request.appId,
      RoomId: process.env.NEXT_PUBLIC_RTC_ROOM_ID || request.roomId,
      TaskId: process.env.NEXT_PUBLIC_RTC_USER_ID || taskId,
      Config: {
        LLMConfig: {
          Mode: 'ArkV3',
          EndPointId: process.env.ARK_ENDPOINT_ID || 'ep-20250603102226-lbgst',
          MaxTokens: 1024,
          Temperature: 0.1,
          TopP: 0.3,
          SystemMessages: [`你是一个智能语音助手，名字是${request.personaId}。请用自然、友好的语调与用户对话。`],
          Prefill: true,
          ModelName: process.env.DOUBAO_MODEL || 'doubao-lite-4k',
          ModelVersion: '1.0',
          WelcomeSpeech: `你好，我是${request.personaId}，很高兴与你对话！`,
          Feature: JSON.stringify({ Http: true }),
        },
        ASRConfig: {
          Provider: 'volcano' as const,
          ProviderParams: {
            Mode: 'bigmodel',
            AppId: process.env.NEXT_PUBLIC_ASR_APP_ID || '',
            AccessToken: process.env.NEXT_PUBLIC_ASR_ACCESS_TOKEN || '',
          },
        },
        TTSConfig: {
          Provider: 'volcano' as const,
          ProviderParams: {
            app: {
              AppId: process.env.NEXT_PUBLIC_TTS_APP_ID || '',
              Cluster: process.env.NEXT_PUBLIC_TTS_CLUSTER || 'volcano_tts',
              ...(process.env.NEXT_PUBLIC_TTS_ACCESS_TOKEN && { Token: process.env.NEXT_PUBLIC_TTS_ACCESS_TOKEN }),
            },
            audio: {
              voice_type: 'BV700_streaming',
              speed_ratio: 1.0,
              encoding: 'wav',
              rate: 24000,
              bitrate: 16,
              loudness_ratio: 1.0,
              explicit_language: 'zh',
              context_language: 'zh',
            },
            request: {
              operation: 'submit',
            },
          },
          IgnoreBracketText: [1, 2, 3, 4, 5],
        },
        InterruptMode: 0,
        SubtitleConfig: {
          SubtitleMode: 0,
          DisableRTSSubtitle: false
        },
      },
      AgentConfig: {
        UserId: "RobotMan_",
        TargetUserId: [process.env.NEXT_PUBLIC_RTC_USER_ID || 'User123'],
        WelcomeMessage: `你好，我是${request.personaId}，很高兴与你对话！`,
        EnableConversationStateCallback: true,
        ServerMessageSignatureForRTS: CONVERSATION_SIGNATURE,
      },
    };

    logger.info('调用火山引擎 StartVoiceChat API', JSON.stringify(apiParams, null, 2));

    // 调用火山引擎 StartVoiceChat API
    const response = await callVolcEngineAPI('StartVoiceChat', '2024-12-01', apiParams);

    logger.info('Server Action: 智能体启动成功', { taskId });

    return {
      success: true,
      taskId,
    };

  } catch (error) {
    logger.error('Server Action: 启动智能体失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 停止智能体 Server Action
 */
export async function stopVoiceChatAction(request: StopVoiceChatRequest): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    logger.info('Server Action: 停止智能体', { taskId: request.TaskId });

    const apiParams = {
      AppId: process.env.NEXT_PUBLIC_RTC_APP_ID || '',
      TaskId: request.TaskId,
    };

    // 调用火山引擎 StopVoiceChat API
    await callVolcEngineAPI('StopVoiceChat', '2024-12-01', apiParams);

    logger.info('Server Action: 智能体停止成功');

    return {
      success: true,
    };

  } catch (error) {
    logger.error('Server Action: 停止智能体失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
