"use client"

import VERTC, { 
  IRTCEngine, 
  MediaType,
  RoomProfileType
  // 移除未使用的StreamIndex
} from '@volcengine/rtc'
import { logger } from './logger'

export type RTCConfig = {
  appId: string
  roomId: string
  uid: string  
  token: string
}

export type RTCEvents = {
  onError?: (error: Error) => void
  onJoinRoom?: () => void
  onLeaveRoom?: () => void
  onRemoteUserJoin?: (userId: string) => void
  onRemoteUserLeave?: (userId: string) => void
  onAudioStart?: () => void
  onAudioStop?: () => void
  onSpeaking?: (userId: string, audioLevel: number) => void
}

/**
 * RTC音频服务
 * 集成火山引擎实时音视频SDK，实现语音通话功能
 */
export class RTCService {
  private static instance: RTCService | null = null
  private engine: IRTCEngine | null = null
  private config: RTCConfig | null = null
  private events: RTCEvents = {}
  private inRoom: boolean = false
  private audioCapturing: boolean = false
  private roomUsers: Set<string> = new Set()

  private constructor() {
    logger.info('RTCService 初始化', { module: 'RTCService' })
  }

  /**
   * 获取RTCService单例
   */
  public static getInstance(): RTCService {
    if (!RTCService.instance) {
      RTCService.instance = new RTCService()
    }
    return RTCService.instance
  }

  /**
   * 初始化RTC引擎
   * @param config RTC配置
   * @param events 事件回调
   */
  public init(config: RTCConfig, events: RTCEvents = {}): void {
    try {
      logger.info('初始化RTC引擎', { module: 'RTCService', data: { appId: config.appId } })

      this.config = config
      this.events = events

      // 创建并初始化RTC引擎实例
      this.engine = VERTC.createEngine(config.appId)
      
      // 注册事件监听
      this.registerEvents()
    } catch (error) {
      logger.error('RTC引擎初始化失败', { module: 'RTCService', error: error as Error })
      this.handleError(error as Error)
    }
  }

  /**
   * 注册RTC事件监听
   */
  private registerEvents(): void {
    if (!this.engine) return

    // 监听用户加入房间事件
    this.engine.on(VERTC.events.onUserJoined, (event) => {
      // SDK可能返回不同结构，我们需要适配
      const userId = typeof event === 'object' && event && 'userId' in event ? 
        (event as {userId: string}).userId : 
        String(event) // 转为字符串作为后备
      
      logger.info('远端用户加入房间', { module: 'RTCService', data: {userId} })
      this.roomUsers.add(userId)
      this.events.onRemoteUserJoin?.(userId)
    })

    // 监听用户离开房间事件
    this.engine.on(VERTC.events.onUserLeave, (event) => {
      // SDK可能返回不同结构，我们需要适配
      const userId = typeof event === 'object' && event && 'userId' in event ? 
        (event as {userId: string}).userId : 
        String(event) // 转为字符串作为后备
        
      logger.info('远端用户离开房间', { module: 'RTCService', data: {userId} })
      this.roomUsers.delete(userId)
      this.events.onRemoteUserLeave?.(userId)
    })

    // 监听远端用户音频发布事件
    this.engine.on(VERTC.events.onUserPublishStream, (event: { userId: string, mediaType: MediaType }) => {
      logger.info('远端用户发布音频流', { module: 'RTCService', data: event })
      
      // 如果发布的是音频或音视频，自动订阅
      if (event.mediaType === MediaType.AUDIO || event.mediaType === MediaType.AUDIO_AND_VIDEO) {
        this.subscribeRemoteAudio(event.userId)
      }
    })

    // 监听音量变化
    this.engine.on(VERTC.events.onAudioVolumeIndication, (event) => {
      // 定义类型接口，适配不同版本SDK
      interface AudioVolumeInfo {
        userId: string;
        volume: number;
      }
      
      // 处理不同版本SDK返回的不同格式
      let speakers: unknown[] = [];
      
      if (Array.isArray(event)) {
        // 直接是数组形式
        speakers = event as unknown[];
      } else if (event && typeof event === 'object' && 'speakers' in event) {
        // 对象形式，先转为unknown，再安全转换
        const eventObj = event as unknown as { speakers: unknown[] };
        speakers = eventObj.speakers;
      }
      
      for (const speaker of speakers) {
        if (typeof speaker === 'object' && speaker && 
            'userId' in speaker && typeof (speaker as Record<string, unknown>).userId === 'string' && 
            'volume' in speaker && typeof (speaker as Record<string, unknown>).volume === 'number') {
          
          const { userId, volume } = speaker as AudioVolumeInfo;
          if (volume > 10) { // 设置一个阈值，避免背景噪音触发
            this.events.onSpeaking?.(userId, volume);
            logger.debug('检测到音量变化', { module: 'RTCService', data: { userId, volume } });
          }
        }
      }
    })
  }

  /**
   * 加入语音房间
   * @param tokenOverride 可选的token参数，覆盖初始化时提供的token
   */
  public async joinRoom(tokenOverride?: string): Promise<boolean> {
    if (!this.engine || !this.config) {
      this.handleError(new Error('RTC引擎未初始化'))
      return false
    }

    try {
      // 使用传入的token或配置中的token
      const token = tokenOverride || this.config.token || null
      
      logger.info('准备加入房间', { 
        module: 'RTCService',
        data: { 
          roomId: this.config.roomId,
          uid: this.config.uid,
          hasToken: !!token // 记录是否有token，不记录token本身
        }
      })

      // 加入RTC房间
      await this.engine.joinRoom(
        token, // 允许null值，与参考实现保持一致
        this.config.roomId,
        {
          userId: this.config.uid,
          extraInfo: JSON.stringify({
            call_scene: 'OPEN-VOICE-CHAT',
            user_id: this.config.uid,
          })
        },
        {
          isAutoPublish: true, // 自动发布
          isAutoSubscribeAudio: true, // 自动订阅音频
          isAutoSubscribeVideo: false, // 不自动订阅视频
          roomProfileType: RoomProfileType.communication // 通信模式
        }
      )

      this.inRoom = true
      this.events.onJoinRoom?.()
      logger.info('成功加入房间', { module: 'RTCService' })
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`加入房间失败: ${errorMessage}`, { 
        module: 'RTCService',
        error: error as Error
      })
      this.handleError(error as Error)
      return false
    }
  }

  /**
   * 离开房间
   */
  public async leaveRoom(): Promise<void> {
    if (!this.engine || !this.inRoom) return

    try {
      // 停止音频
      await this.stopAudio()
      
      // 离开房间
      await this.engine.leaveRoom()
      this.inRoom = false
      this.roomUsers.clear()
      
      logger.info('已离开房间', { module: 'RTCService' })
      this.events.onLeaveRoom?.()
    } catch (error) {
      logger.error('离开房间出错', { module: 'RTCService', error: error as Error })
    }
  }

  /**
   * 开始音频采集并发布
   */
  public async startAudio(): Promise<boolean> {
    if (!this.engine || !this.inRoom) {
      this.handleError(new Error('未加入房间或RTC引擎未初始化'))
      return false
    }

    try {
      if (!this.audioCapturing) {
        // 开始音频采集
        await this.engine.startAudioCapture()
        
        // 发布音频流
        await this.engine.publishStream(MediaType.AUDIO)
        
        this.audioCapturing = true
        logger.info('音频采集已开始', { module: 'RTCService' })
        this.events.onAudioStart?.()
      }
      return true
    } catch (error) {
      logger.error('开始音频采集失败', { module: 'RTCService', error: error as Error })
      this.handleError(error as Error)
      return false
    }
  }

  /**
   * 停止音频采集和发布
   */
  public async stopAudio(): Promise<void> {
    if (!this.engine || !this.audioCapturing) return

    try {
      // 停止发布音频流
      await this.engine.unpublishStream(MediaType.AUDIO)
      
      // 停止音频采集
      await this.engine.stopAudioCapture()
      
      this.audioCapturing = false
      logger.info('音频采集已停止', { module: 'RTCService' })
      this.events.onAudioStop?.()
    } catch (error) {
      logger.error('停止音频采集失败', { module: 'RTCService', error: error as Error })
    }
  }

  /**
   * 订阅远端用户的音频
   * @param userId 远端用户ID
   */
  private async subscribeRemoteAudio(userId: string): Promise<void> {
    if (!this.engine || !this.inRoom) return

    try {
      await this.engine.subscribeStream(userId, MediaType.AUDIO)
      logger.info('已订阅远端音频', { module: 'RTCService', data: { userId } })
    } catch (error) {
      logger.error('订阅远端音频失败', { module: 'RTCService', error: error as Error })
    }
  }

  /**
   * 启用音量监测
   * @param interval 音量监测的时间间隔(毫秒)
   */
  public enableAudioVolumeIndication(interval = 500): void {
    if (!this.engine) return
    
    // 适配不同版本的SDK API
    // 定义一个扩展类型，替代原来的any
    interface RTCEngineExtended {
      enableAudioVolumeIndication: (configOrInterval: number | {interval: number}, smooth?: number, reportVad?: boolean) => void;
    }
    
    const engine = this.engine as unknown as RTCEngineExtended;
    try {
      // 如果是对象参数的新版API
      if ('enableAudioVolumeIndication' in engine && 
          typeof engine.enableAudioVolumeIndication === 'function') {
        try {
          // 尝试调用新格式 API
          engine.enableAudioVolumeIndication({ interval })
          logger.debug('使用新版音量监测 API', { module: 'RTCService' })
        } catch {
          // 如果失败，尝试调用旧格式 API
          engine.enableAudioVolumeIndication(interval, 3, true)
          logger.debug('使用旧版音量监测 API', { module: 'RTCService' })
        }
      } else {
        // 直接调用旧格式 API
        engine.enableAudioVolumeIndication(interval, 3, true)
        logger.debug('使用默认音量监测 API', { module: 'RTCService' })
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error enabling audio indication')
      logger.error('启用音量监测失败', { module: 'RTCService', error: err })
      return
    }
    
    logger.info('已启用音量监测', { module: 'RTCService', data: { interval } })
  }

  /**
   * 错误处理
   */
  private handleError(error: Error): void {
    // 触发错误事件
    this.events.onError?.(error)
  }

  /**
   * 销毁RTC服务
   */
  public destroy(): void {
    if (this.inRoom) {
      this.leaveRoom()
    }

    if (this.engine) {
      this.engine.destroy()
      this.engine = null
    }

    RTCService.instance = null
    logger.info('RTC服务已销毁', { module: 'RTCService' })
  }
}
