import VERTC, { IRTCEngine, MediaType, RoomProfileType, StreamIndex } from "@volcengine/rtc"
import RTCAIAnsExtension from "@volcengine/rtc/extension-ainr"
import { logger } from "../lib/logger"

export interface RTCConfig {
  appId: string
  roomId: string
  userId: string
  token: string
  isAutoPublish?: boolean
  isAutoSubscribeAudio?: boolean
  isAutoSubscribeVideo?: boolean
}

export interface AudioStatus {
  isConnected: boolean
  isMicrophoneOn: boolean
  isSpeakerOn: boolean
  isProcessing: boolean
  error?: Error
}

export class RTCClient {
  private engine: IRTCEngine | null = null
  private config: RTCConfig | null = null
  private audioStatus: AudioStatus = {
    isConnected: false,
    isMicrophoneOn: false,
    isSpeakerOn: false,
    isProcessing: false,
  }

  private eventCallbacks: Record<string, Array<(...args: any[]) => void>> = {}

  constructor() {
    logger.debug("RTCClient created")
  }

  /**
   * 初始化 RTC 引擎
   */
  public async initialize(appId: string): Promise<void> {
    try {
      if (this.engine) {
        logger.warn("RTC Engine already initialized")
        return
      }

      this.engine = VERTC.createEngine(appId)

      // try {
      //   const AIAnsExtension = new RTCAIAnsExtension()
      //   await this.engine.registerExtension(AIAnsExtension)
      //   AIAnsExtension.enable()
      //   logger.info("AI 降噪已启用")
      // } catch (error) {
      //   logger.warn(`当前环境不支持 AI 降噪, 此错误可忽略, 不影响实际使用, e: ${(error as any).message}`)
      // }

      logger.info("RTC Engine initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize RTC Engine", error)
      throw error
    }
  }

  /**
   * 加入房间
   */
  public async connect(config: RTCConfig): Promise<void> {
    logger.info("准备加入房间", {
      config,
    })

    try {
      if (!this.engine) {
        throw new Error("RTC Engine not initialized")
      }

      this.engine.enableAudioPropertiesReport({ interval: 1000 });

      this.config = config
      this.audioStatus.isProcessing = true

      await this.engine.joinRoom(
        config.token,
        config.roomId,
        {
          userId: config.userId,
          extraInfo: JSON.stringify({
            call_scene: 'RTC-AIGC',
            user_name: config.userId,
            user_id: config.userId,
          }),
        },
        {
          isAutoPublish: config.isAutoPublish ?? true,
          isAutoSubscribeAudio: config.isAutoSubscribeAudio ?? true,
          isAutoSubscribeVideo: config.isAutoSubscribeVideo ?? false,
          roomProfileType: RoomProfileType.chat,
        }
      )

      if (this.audioStatus.isMicrophoneOn) {
        logger.warn("[RTCClient] Microphone is already on")
      }

      await this.engine.startAudioCapture()

      // 如果设置不自动发布，则需要手动发布
      if (this.config && this.config.isAutoPublish) {
        logger.info("[RTCClient] Auto publishing audio stream")
      }

      await this.engine.publishStream(MediaType.AUDIO)

      this.audioStatus.isMicrophoneOn = true
      logger.info("[RTCClient] DONE Started audio capture")

      this.audioStatus.isConnected = true
      this.audioStatus.isProcessing = false
      logger.info(`Joined room: ${config.roomId}`)
    } catch (error) {
      this.audioStatus.isProcessing = false
      this.audioStatus.error = error as Error
      logger.error("Failed to join room", error)
      throw error
    }
  }

  /**
   * 离开房间
   */
  public async disconnect(): Promise<void> {
    try {
      if (!this.engine) {
        throw new Error("RTC Engine not initialized")
      }

      this.audioStatus.isProcessing = true
      await this.engine.leaveRoom()

      this.unregisterEventListeners()

      await this.engine.stopAudioCapture()
      logger.info("Stopped audio capture")

      this.audioStatus = {
        isConnected: false,
        isMicrophoneOn: false,
        isSpeakerOn: false,
        isProcessing: false,
      }

      logger.info("Left room")
    } catch (error) {
      this.audioStatus.isProcessing = false
      this.audioStatus.error = error as Error
      logger.error("Failed to leave room", error)
      throw error
    }
  }

  /**
   * 获取当前音频状态
   */
  public getAudioStatus(): AudioStatus {
    return { ...this.audioStatus }
  }

  /**
   * 添加事件监听
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = []
    }
    this.eventCallbacks[event].push(callback)
  }

  /**
   * 注册外部事件监听器（用于 useVoiceChat hook）
   */
  public registerEventListeners(listeners: Record<string, (...args: any[]) => void>): void {
    logger.info("Registering event listeners", listeners)
    
    if (!this.engine) {
      logger.warn("RTC Engine not initialized, cannot register listeners")
      return
    }

    // 注册错误事件
    if (listeners.handleError) {
      this.engine.on(VERTC.events.onError, listeners.handleError)
    }

    // 注册用户加入事件
    if (listeners.handleUserJoin) {
      this.engine.on(VERTC.events.onUserJoined, listeners.handleUserJoin)
    }

    // 注册用户离开事件
    if (listeners.handleUserLeave) {
      this.engine.on(VERTC.events.onUserLeave, listeners.handleUserLeave)
    }

    // 注册用户发布流事件
    if (listeners.handleUserPublishStream) {
      this.engine.on(VERTC.events.onUserPublishStream, listeners.handleUserPublishStream)
    }

    // 注册用户取消发布流事件
    if (listeners.handleUserUnpublishStream) {
      this.engine.on(VERTC.events.onUserUnpublishStream, listeners.handleUserUnpublishStream)
    }

    // 注册本地音频属性报告
    if (listeners.handleLocalAudioPropertiesReport) {
      this.engine.on(VERTC.events.onLocalAudioPropertiesReport, listeners.handleLocalAudioPropertiesReport)
    }

    // 注册远端音频属性报告
    if (listeners.handleRemoteAudioPropertiesReport) {
      this.engine.on(VERTC.events.onRemoteAudioPropertiesReport, listeners.handleRemoteAudioPropertiesReport)
    }

    // 注册音频设备状态变化
    if (listeners.handleAudioDeviceStateChanged) {
      this.engine.on(VERTC.events.onAudioDeviceStateChanged, listeners.handleAudioDeviceStateChanged)
    }

    // 注册播放器事件
    if (listeners.handlePlayerEvent) {
      this.engine.on(VERTC.events.onPlayerEvent, listeners.handlePlayerEvent)
    }

    // 注册用户开始音频采集
    if (listeners.handleUserStartAudioCapture) {
      this.engine.on(VERTC.events.onUserStartAudioCapture, listeners.handleUserStartAudioCapture)
    }

    // 注册用户停止音频采集
    if (listeners.handleUserStopAudioCapture) {
      this.engine.on(VERTC.events.onUserStopAudioCapture, listeners.handleUserStopAudioCapture)
    }

    // 注册网络质量事件
    if (listeners.handleNetworkQuality) {
      this.engine.on(VERTC.events.onNetworkQuality, listeners.handleNetworkQuality)
    }

    // 注册房间二进制消息接收
    if (listeners.handleRoomBinaryMessageReceived) {
      this.engine.on(VERTC.events.onRoomBinaryMessageReceived, listeners.handleRoomBinaryMessageReceived)
    }

    logger.info("[RTCClient] External event listeners registered")
  }

  /**
   * 取消注册外部事件监听器
   */
  public unregisterEventListeners(): void {
    if (!this.engine) return

    // 移除所有外部注册的事件监听器
    this.engine.off(VERTC.events.onError)
    this.engine.off(VERTC.events.onUserJoined)
    this.engine.off(VERTC.events.onUserLeave)
    this.engine.off(VERTC.events.onUserPublishStream)
    this.engine.off(VERTC.events.onUserUnpublishStream)
    this.engine.off(VERTC.events.onLocalAudioPropertiesReport)
    this.engine.off(VERTC.events.onRemoteAudioPropertiesReport)
    this.engine.off(VERTC.events.onAudioDeviceStateChanged)
    this.engine.off(VERTC.events.onPlayerEvent)
    this.engine.off(VERTC.events.onUserStartAudioCapture)
    this.engine.off(VERTC.events.onUserStopAudioCapture)
    this.engine.off(VERTC.events.onNetworkQuality)
    this.engine.off(VERTC.events.onRoomBinaryMessageReceived)

    logger.info("External event listeners unregistered")
  }

}

// 导出单例实例
export const rtcClient = new RTCClient()
