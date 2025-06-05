import { logger } from './logger';

/**
 * 豆包 AI 消息类型
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 豆包 AI 对话参数
 */
export interface AIConversationParams {
  messages: AIMessage[];
  temperature?: number;
  model?: string;
  personaId?: string;
}

/**
 * 豆包 AI 服务配置
 */
export interface AIServiceConfig {
  apiKey: string;
  apiEndpoint: string;
  defaultModel: string;
  defaultTemperature: number;
}

/**
 * 豆包 AI 对话响应
 */
export interface AIConversationResponse {
  id: string;
  message: AIMessage;
  finishReason: string;
}

/**
 * 豆包 AI 服务类
 * 负责与豆包 API 进行通信，处理对话生成
 */
export class AIService {
  private config: AIServiceConfig;
  
  constructor(config: AIServiceConfig) {
    this.config = config;
    logger.info('AIService initialized');
  }
  
  /**
   * 发送消息到豆包 AI 并获取回复
   */
  public async sendConversation(params: AIConversationParams): Promise<AIConversationResponse> {
    try {
      logger.info('Sending conversation to AI service', { personaId: params.personaId });
      
      const body = {
        messages: params.messages,
        temperature: params.temperature || this.config.defaultTemperature,
        model: params.model || this.config.defaultModel,
      };
      
      // 注意：这里需要替换为实际的豆包 API 调用
      // 目前使用 mock 数据进行演示
      const mockResponse: AIConversationResponse = await this.mockAIResponse(body.messages);
      
      logger.info('Received AI response', { id: mockResponse.id });
      return mockResponse;
    } catch (error) {
      logger.error('Error sending conversation to AI service', error);
      throw error;
    }
  }
  
  /**
   * 模拟豆包 AI 响应 (仅用于开发测试)
   * 实际项目中应替换为真实 API 调用
   */
  private async mockAIResponse(messages: AIMessage[]): Promise<AIConversationResponse> {
    return new Promise((resolve) => {
      const lastMessage = messages[messages.length - 1];
      
      const responses: Record<string, string> = {
        "你好": "你好！有什么我可以帮助你的吗？",
        "介绍一下你自己": "我是豆包AI助手，很高兴为你服务。我可以回答问题、提供信息和进行日常对话。",
        "今天天气怎么样": "我没有实时访问天气数据的能力。不过，你可以打开天气应用或网站查看当前的天气状况。",
        "讲个笑话": "为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。"
      };
      
      // 简单的模拟响应逻辑
      let reply = "我不太理解你的意思，能否换个方式表达？";
      
      // 尝试匹配一些关键词
      Object.keys(responses).forEach(key => {
        if (lastMessage.content.includes(key)) {
          reply = responses[key];
        }
      });
      
      setTimeout(() => {
        resolve({
          id: `mock-${Date.now()}`,
          message: {
            role: 'assistant',
            content: reply
          },
          finishReason: 'stop'
        });
      }, 300); // 模拟网络延迟
    });
  }

  /**
   * 更新服务配置
   */
  public updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('AIService configuration updated');
  }
}

// 导出默认实例
export const aiService = new AIService({
  apiKey: process.env.DOUBAO_API_KEY || '',
  apiEndpoint: process.env.DOUBAO_API_ENDPOINT || 'https://api.doubao.com',
  defaultModel: 'doubao-001',
  defaultTemperature: 0.7
});
