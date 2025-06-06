/**
 * 日志服务 - 为整个应用提供统一的日志记录功能
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  minLevel: LogLevel;
  enableConsole: boolean;
}

class Logger {
  private options: LoggerOptions;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options?: Partial<LoggerOptions>) {
    this.options = {
      minLevel: options?.minLevel || 'info',
      enableConsole: options?.enableConsole ?? true
    };
  }

  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.options.minLevel = level;
  }

  /**
   * 启用或禁用控制台输出
   */
  public setEnableConsole(enable: boolean): void {
    this.options.enableConsole = enable;
  }

  /**
   * 记录调试级别日志
   */
  public debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * 记录信息级别日志
   */
  public info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  /**
   * 记录警告级别日志
   */
  public warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * 记录错误级别日志
   */
  public error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  /**
   * 内部日志记录方法
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // 检查日志级别是否应该被记录
    if (this.levelPriority[level] < this.levelPriority[this.options.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 控制台输出
    if (this.options.enableConsole) {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage, ...args);
          break;
        case 'info':
          console.info(formattedMessage, ...args);
          break;
        case 'warn':
          console.warn(formattedMessage, ...args);
          break;
        case 'error':
          console.error(formattedMessage, ...args);
          break;
      }
    }

    // 这里可以扩展其他日志输出方式，如文件、远程服务等
  }
}

// 导出单例实例
export const logger = new Logger({
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
});
