'use server';

import { logger } from '../../services/logger';

/**
 * StartVoiceChat 请求参数
 */
interface StartVoiceChatRequest {
  appId: string;
  roomId: string;
  personaId: string;
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
      AppId: request.appId,
      RoomId: request.roomId,
      TaskId: taskId,
      Config: {
        ASRConfig: {
          Provider: 'volcano' as const,
          ProviderParams: {
            Mode: 'bigmodel' as const,
            AppId: process.env.VOLCANO_ASR_APP_ID || '',
            AccessToken: process.env.VOLCANO_ASR_ACCESS_TOKEN || '',
            Language: 'zh-CN',
            Domain: 'common',
          },
        },
        TTSConfig: {
          Provider: 'volcano' as const,
          ProviderParams: {
            AppId: process.env.VOLCANO_TTS_APP_ID || '',
            cluster: process.env.VOLCANO_TTS_CLUSTER || 'volcano_tts',
            voice_type: 'BV700_streaming',
            speed_rate: 1.0,
            volume_rate: 1.0,
            pitch_rate: 0,
            emotion: 'happy',
            language: 'zh',
          },
        },
        LLMConfig: {
          Provider: 'doubao' as const,
          ProviderParams: {
            EndpointId: process.env.DOUBAO_ENDPOINT_ID || '',
            model: process.env.DOUBAO_MODEL || 'doubao-lite-4k',
            max_tokens: 2000,
            temperature: 0.8,
            top_p: 0.9,
          },
        },
        SubtitleConfig: {
          Enable: true,
          SubtitleMode: 0,
        },
      },
    };

    // 调用火山引擎 StartVoiceChat API
    const response = await callVolcanoApi('StartVoiceChat', '2024-12-01', apiParams);

    if (response.ResponseMetadata?.Error) {
      throw new Error(`API 错误: ${response.ResponseMetadata.Error.Code} - ${response.ResponseMetadata.Error.Message}`);
    }

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
export async function stopVoiceChatAction(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    logger.info('Server Action: 停止智能体', { taskId });

    const apiParams = {
      AppId: process.env.NEXT_PUBLIC_RTC_APP_ID || '',
      RoomId: process.env.NEXT_PUBLIC_RTC_ROOM_ID || '',
      TaskId: taskId,
    };

    // 调用火山引擎 StopVoiceChat API
    await callVolcanoApi('StopVoiceChat', '2024-12-01', apiParams);

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

/**
 * 调用火山引擎 API
 */
async function callVolcanoApi(action: string, version: string, body: any): Promise<any> {
  const url = new URL('https://rtc.volcengineapi.com');
  url.searchParams.append('Action', action);
  url.searchParams.append('Version', version);

  // 构造请求头
  const headers = {
    'Content-Type': 'application/json',
    'X-Date': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    // 注意：这里需要实现完整的火山引擎签名算法
    // 为了快速测试，先返回模拟响应
  };

  logger.info('API 请求:', { url: url.toString(), headers, body });

  // 临时模拟响应，避免真实 API 调用
  // 实际项目中需要实现完整的火山引擎签名算法
  if (process.env.NODE_ENV === 'development') {
    logger.warn('开发环境：使用模拟响应');
    return {
      ResponseMetadata: {
        RequestId: `req_${Date.now()}`,
        Action: action,
        Version: version,
        Service: 'rtc',
        Region: 'cn-north-1',
      },
      Result: {
        TaskId: body.TaskId,
        Status: 'running',
      },
    };
  }

  // 实际的 API 调用
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return await response.json();
}
