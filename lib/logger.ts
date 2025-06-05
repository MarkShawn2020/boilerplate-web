/**
 * 全局日志记录器
 * 封装一致的日志格式，方便排查问题
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  module?: string;
  data?: unknown;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, options?: LogOptions): string {
    const timestamp = new Date().toISOString();
    const module = options?.module ? `[${options.module}]` : '';
    return `[${timestamp}][${level.toUpperCase()}]${module} ${message}`;
  }

  private log(level: LogLevel, message: string, options?: LogOptions): void {
    const formattedMessage = this.formatMessage(level, message, options);
    
    // 在开发环境打印日志到控制台
    if (this.isDevelopment || level !== 'debug') {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, options?.data || '');
          break;
        case 'info':
          console.info(formattedMessage, options?.data || '');
          break;
        case 'warn':
          console.warn(formattedMessage, options?.data || '');
          break;
        case 'error':
          console.error(
            formattedMessage,
            options?.error ? options.error : options?.data || ''
          );
          break;
      }
    }

    // 在生产环境可以集成第三方日志服务
    // TODO: 集成生产环境日志服务
  }

  debug(message: string, options?: LogOptions): void {
    this.log('debug', message, options);
  }

  info(message: string, options?: LogOptions): void {
    this.log('info', message, options);
  }

  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options);
  }

  error(message: string, options?: LogOptions): void {
    this.log('error', message, options);
  }
}

// 导出单例
export const logger = Logger.getInstance();
