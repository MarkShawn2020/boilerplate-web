import { logger } from '../lib/logger';

/**
 * 字幕数据结构
 */
export interface SubtitleData {
  text: string;
  language: string;
  userId: string;
  sequence: number;
  definite: boolean;
  paragraph: boolean;
}

/**
 * 字幕消息结构
 */
export interface SubtitleMessage {
  type: string;
  data: SubtitleData[];
}

/**
 * 字幕解析器类
 */
export class SubtitleParser {
  private static readonly MAGIC_NUMBER = 0x73756276; // "subv"
  private static readonly HEADER_SIZE = 8;

  /**
   * 解析二进制字幕消息
   * @param message 二进制消息数据
   * @returns 解析后的字幕数据数组，解析失败时返回 null
   */
  public static parseSubtitleMessage(message: Uint8Array): SubtitleData[] | null {
    try {
      // 1. 验证消息头
      const subtitleJson = this.unpackMessage(message);
      if (!subtitleJson) {
        logger.warn('字幕消息拆包失败');
        return null;
      }

      // 2. 解析 JSON 数据
      const subtitleMessage: SubtitleMessage = JSON.parse(subtitleJson);
      
      // 3. 验证消息类型
      if (subtitleMessage.type !== 'subtitle') {
        logger.warn('不是字幕类型消息:', subtitleMessage.type);
        return null;
      }

      // 4. 验证数据格式
      if (!Array.isArray(subtitleMessage.data)) {
        logger.warn('字幕数据格式错误');
        return null;
      }

      // 5. 返回字幕数据
      logger.debug('成功解析字幕数据:', subtitleMessage.data);
      return subtitleMessage.data;

    } catch (error) {
      logger.error('字幕解析失败:', error);
      return null;
    }
  }

  /**
   * 拆包校验二进制消息
   * @param message 二进制消息
   * @returns 字幕 JSON 字符串，校验失败时返回 null
   */
  private static unpackMessage(message: Uint8Array): string | null {
    try {
      // 检查消息长度
      if (message.length < this.HEADER_SIZE) {
        logger.warn('字幕消息长度不足');
        return null;
      }

      // 验证魔数 "subv"
      const magicNumber = (message[0] << 24) | (message[1] << 16) | (message[2] << 8) | message[3];
      if (magicNumber !== this.MAGIC_NUMBER) {
        logger.warn('字幕消息魔数校验失败');
        return null;
      }

      // 读取消息长度（大端序）
      const length = (message[4] << 24) | (message[5] << 16) | (message[6] << 8) | message[7];
      
      // 验证消息长度
      if (message.length - this.HEADER_SIZE !== length) {
        logger.warn('字幕消息长度校验失败');
        return null;
      }

      // 提取字幕 JSON 数据
      if (length === 0) {
        return '';
      }

      const jsonBytes = message.slice(this.HEADER_SIZE, this.HEADER_SIZE + length);
      const jsonString = new TextDecoder('utf-8').decode(jsonBytes);
      
      return jsonString;

    } catch (error) {
      logger.error('字幕消息拆包错误:', error);
      return null;
    }
  }

  /**
   * 判断是否为用户发言
   * @param userId 用户ID
   * @returns 是否为用户发言
   */
  public static isUserMessage(userId: string): boolean {
    // 根据实际的用户ID规则判断
    // 这里假设以 "bot" 开头的是智能体，其他是用户
    return !userId.toLowerCase().startsWith('bot');
  }

  /**
   * 判断是否为完整句子
   * @param subtitleData 字幕数据
   * @returns 是否为完整句子
   */
  public static isCompleteSentence(subtitleData: SubtitleData): boolean {
    return subtitleData.definite && subtitleData.paragraph;
  }

  /**
   * 判断是否为完整分句
   * @param subtitleData 字幕数据
   * @returns 是否为完整分句
   */
  public static isCompletePhrase(subtitleData: SubtitleData): boolean {
    return subtitleData.definite;
  }
}
