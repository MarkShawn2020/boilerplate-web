import { IRTCEngine, MediaType, RoomProfileType, StreamIndex } from '@volcengine/rtc';
import VERTC from '@volcengine/rtc';
import { logger } from './logger';

export interface RTCConfig {
  appId: string;
  roomId: string;
  userId: string;
  token: string;
  isAutoPublish?: boolean;
  isAutoSubscribeAudio?: boolean;
  isAutoSubscribeVideo?: boolean;
}

export interface AudioStatus {
  isConnected: boolean;
  isMicrophoneOn: boolean;
  isSpeakerOn: boolean;
  isProcessing: boolean;
  error?: Error;
}

export class RTCEngineService {
  private engine: IRTCEngine | null = null;
  private config: RTCConfig | null = null;
  private audioStatus: AudioStatus = {
    isConnected: false,
    isMicrophoneOn: false,
    isSpeakerOn: false,
    isProcessing: false,
  };
  
  private eventCallbacks: Record<string, Array<(...args: any[]) => void>> = {};

  constructor() {
    logger.debug('RTCEngineService created');
  }

  /**
   * 初始化 RTC 引擎
   */
  public initialize(appId: string): void {
    try {
      if (this.engine) {
        logger.warn('RTC Engine already initialized');
        return;
      }
      
      this.engine = VERTC.createEngine(appId);
      this.setupEventListeners();
      logger.info('RTC Engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RTC Engine', error);
      throw error;
    }
  }

  /**
   * 加入房间
   */
  public async joinRoom(config: RTCConfig): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error('RTC Engine not initialized');
      }

      this.config = config;
      this.audioStatus.isProcessing = true;

      logger.info('准备加入房间', {
        config
      });

      await this.engine.joinRoom(
        config.token,
        config.roomId,
        {
          userId: config.userId,
        },
        {
          isAutoPublish: config.isAutoPublish ?? true,
          isAutoSubscribeAudio: config.isAutoSubscribeAudio ?? true,
          isAutoSubscribeVideo: config.isAutoSubscribeVideo ?? false,
          roomProfileType: RoomProfileType.communication
        }
      );
      
      this.audioStatus.isConnected = true;
      this.audioStatus.isProcessing = false;
      logger.info(`Joined room: ${config.roomId}`);
    } catch (error) {
      this.audioStatus.isProcessing = false;
      this.audioStatus.error = error as Error;
      logger.error('Failed to join room', error);
      throw error;
    }
  }

  /**
   * 离开房间
   */
  public async leaveRoom(): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error('RTC Engine not initialized');
      }
      
      this.audioStatus.isProcessing = true;
      await this.stopAudioCapture();
      await this.engine.leaveRoom();
      
      this.audioStatus = {
        isConnected: false,
        isMicrophoneOn: false,
        isSpeakerOn: false,
        isProcessing: false,
      };
      
      logger.info('Left room');
    } catch (error) {
      this.audioStatus.isProcessing = false;
      this.audioStatus.error = error as Error;
      logger.error('Failed to leave room', error);
      throw error;
    }
  }

  /**
   * 开始音频采集
   */
  public async startAudioCapture(): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error('RTC Engine not initialized');
      }

      if (this.audioStatus.isMicrophoneOn) {
        logger.warn('Microphone is already on');
        return;
      }

      await this.engine.startAudioCapture();
      
      // 如果设置不自动发布，则需要手动发布
      if (this.config && !this.config.isAutoPublish) {
        await this.engine.publishStream(MediaType.AUDIO);
      }
      
      this.audioStatus.isMicrophoneOn = true;
      logger.info('Started audio capture');
    } catch (error) {
      logger.error('Failed to start audio capture', error);
      throw error;
    }
  }

  /**
   * 停止音频采集
   */
  public async stopAudioCapture(): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error('RTC Engine not initialized');
      }

      if (!this.audioStatus.isMicrophoneOn) {
        return;
      }

      await this.engine.stopAudioCapture();
      this.audioStatus.isMicrophoneOn = false;
      logger.info('Stopped audio capture');
    } catch (error) {
      logger.error('Failed to stop audio capture', error);
      throw error;
    }
  }

  /**
   * 静音/取消静音本地音频
   */
  public async toggleMicrophone(): Promise<boolean> {
    try {
      if (this.audioStatus.isMicrophoneOn) {
        await this.stopAudioCapture();
        return false;
      } else {
        await this.startAudioCapture();
        return true;
      }
    } catch (error) {
      logger.error('Failed to toggle microphone', error);
      throw error;
    }
  }

  /**
   * 设置远程用户视频播放器
   */
  public async setRemoteAudioPlayer(userId: string, domId: string): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error('RTC Engine not initialized');
      }

      await this.engine.setRemoteVideoPlayer(StreamIndex.STREAM_INDEX_MAIN, {
        userId,
        renderDom: domId,
      });
      
      this.audioStatus.isSpeakerOn = true;
      logger.info(`Set remote audio player for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to set remote audio player', error);
      throw error;
    }
  }

  /**
   * 获取当前音频状态
   */
  public getAudioStatus(): AudioStatus {
    return { ...this.audioStatus };
  }

  /**
   * 释放资源
   */
  public destroy(): void {
    if (this.engine) {
      this.removeEventListeners();
      this.engine = null;
      this.config = null;
      this.audioStatus = {
        isConnected: false,
        isMicrophoneOn: false,
        isSpeakerOn: false,
        isProcessing: false,
      };
      logger.info('RTC Engine destroyed');
    }
  }

  /**
   * 添加事件监听
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  /**
   * 移除事件监听
   */
  public off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event] = this.eventCallbacks[event].filter(cb => cb !== callback);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.engine) return;
    
    // 监听远端用户发布流
    this.engine.on(VERTC.events.onUserPublishStream, (e: {userId: string, mediaType: MediaType}) => {
      logger.info(`User ${e.userId} published stream with mediaType ${e.mediaType}`);
      
      if (this.eventCallbacks[VERTC.events.onUserPublishStream]) {
        this.eventCallbacks[VERTC.events.onUserPublishStream]?.forEach(callback => callback(e));
      }
    });
    
    // 监听远端用户取消发布流
    this.engine.on(VERTC.events.onUserUnpublishStream, (e: {userId: string, mediaType: MediaType}) => {
      logger.info(`User ${e.userId} unpublished stream with mediaType ${e.mediaType}`);
      
      if (this.eventCallbacks[VERTC.events.onUserUnpublishStream]) {
        this.eventCallbacks[VERTC.events.onUserUnpublishStream]?.forEach(callback => callback(e));
      }
    });
    
    // 监听用户加入房间
    this.engine.on(VERTC.events.onUserJoined, (event: any) => {
      const userId = typeof event === 'object' && event.userId ? event.userId : 'unknown';
      logger.info(`User ${userId} joined the room`);
      
      if (this.eventCallbacks[VERTC.events.onUserJoined]) {
        this.eventCallbacks[VERTC.events.onUserJoined]?.forEach(callback => callback(event));
      }
    });
    
    // 监听用户离开房间
    this.engine.on(VERTC.events.onUserLeave, (event: any) => {
      const userId = typeof event === 'object' && event.userId ? event.userId : 'unknown';
      logger.info(`User ${userId} left the room`);
      
      if (this.eventCallbacks[VERTC.events.onUserLeave]) {
        this.eventCallbacks[VERTC.events.onUserLeave]?.forEach(callback => callback(event));
      }
    });
    
    // 监听连接状态变化
    this.engine.on(VERTC.events.onConnectionStateChanged, (e: {state: number}) => {
      logger.info(`Connection state changed to ${e.state}`);
      
      if (this.eventCallbacks[VERTC.events.onConnectionStateChanged]) {
        this.eventCallbacks[VERTC.events.onConnectionStateChanged]?.forEach(callback => callback(e));
      }
    });
    
    // 监听错误
    this.engine.on(VERTC.events.onError, (event: any) => {
      // 兼容SDK不同版本的错误结构
      const errorCode = event?.errorCode || event?.code || 'unknown';
      const message = event?.message || '';
      const forbiddenTime = event?.forbiddenTime || 0;
      
      logger.error(`RTC Engine error: ${errorCode} - ${message} ${forbiddenTime ? `(Forbidden for ${forbiddenTime}s)` : ''}`);
      
      if (this.eventCallbacks[VERTC.events.onError]) {
        this.eventCallbacks[VERTC.events.onError]?.forEach(callback => callback(event));
      }
    });
  }
  
  /**
   * 移除事件监听器
   */
  private removeEventListeners(): void {
    if (!this.engine) return;
    
    this.engine.off(VERTC.events.onUserPublishStream);
    this.engine.off(VERTC.events.onUserUnpublishStream);
    this.engine.off(VERTC.events.onUserJoined);
    this.engine.off(VERTC.events.onUserLeave);
    this.engine.off(VERTC.events.onConnectionStateChanged);
    this.engine.off(VERTC.events.onError);
  }
}

// 导出单例实例
export const rtcEngineService = new RTCEngineService();
