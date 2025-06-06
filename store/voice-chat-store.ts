"use client"

import VERTC, {
  AutoPlayFailedEvent,
  DeviceInfo,
  LocalAudioPropertiesInfo,
  MediaType,
  NetworkQuality,
  onUserJoinedEvent,
  onUserLeaveEvent,
  PlayerEvent,
  RemoteAudioPropertiesInfo,
  StreamIndex,
  StreamRemoveReason,
} from "@volcengine/rtc"
import { defaultPersonas } from "data/personas"
import { toast } from "sonner"
import { create } from "zustand"
import { startVoiceChatAction, stopVoiceChatAction } from "../app/actions/voice-chat-actions"
import { env } from "../env.mjs"
import { logger } from "../lib/logger"
import { AudioStatus, rtcClient } from "../lib/rtc-client"
import type { SubtitleData } from "../lib/subtitle-parser"
import { SubtitleParser } from "../lib/subtitle-parser"
import { AIMessage } from "../services/ai-service"

// 人设接口
export interface Persona {
  id: string
  name: string
  description: string
  avatar: string
  voiceId?: string
  systemPrompt?: string
}

// 对话状态枚举
export enum CallState {
  IDLE = "idle",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  SPEAKING = "speaking",
  LISTENING = "listening",
  THINKING = "thinking",
  DISCONNECTING = "disconnecting",
  ERROR = "error",
}

// 扩展消息结构以支持字幕
export interface ChatMessage extends AIMessage {
  id: string
  timestamp: number
  isFromSubtitle?: boolean // 是否来自字幕
  subtitleData?: SubtitleData // 原始字幕数据
}

// 实时字幕状态
export interface RealtimeSubtitle {
  userId: string
  text: string
  sequence: number
  isComplete: boolean // 是否为完整句子
  timestamp: number
}

// 语音对话存储状态
export interface VoiceChatState {
  // 基础配置
  rtcAppId: string
  rtcToken: string
  rtcRoomId: string
  userId: string

  // 人设相关
  personas: Persona[]
  selectedPersona: Persona | null

  // 通话状态
  callState: CallState
  audioStatus: AudioStatus
  error: Error | null
  taskId: string | null
  isAgentActive: boolean

  // 音频相关
  audioLevel: number
  isMuted: boolean
  isRecording: boolean

  // 消息和字幕
  messages: ChatMessage[]
  realtimeSubtitles: Map<string, RealtimeSubtitle>

  // 服务状态
  isServicesInitialized: boolean

  // 内部状态（用于 RTC 事件监听）
  playStatus: { [key: string]: { audio: boolean } }

  // === 初始化方法 ===
  initializeServices: () => Promise<void>

  // === RTC 事件处理方法 ===
  handleError: (e: { errorCode: typeof VERTC.ErrorCode }) => void
  handleUserJoin: (e: onUserJoinedEvent) => void
  handleUserLeave: (e: onUserLeaveEvent) => void
  handleUserPublishStream: (e: { userId: string; mediaType: MediaType }) => void
  handleUserUnpublishStream: (e: { userId: string; mediaType: MediaType; reason: StreamRemoveReason }) => void
  handleLocalAudioPropertiesReport: (e: LocalAudioPropertiesInfo[]) => void
  handleRemoteAudioPropertiesReport: (e: RemoteAudioPropertiesInfo[]) => void
  handleAudioDeviceStateChanged: (device: DeviceInfo) => void
  handleAutoPlayFail: (event: AutoPlayFailedEvent) => void
  handlePlayerEvent: (event: PlayerEvent) => void
  handleUserStartAudioCapture: (e: { userId: string }) => void
  handleUserStopAudioCapture: (e: { userId: string }) => void
  handleNetworkQuality: (uplink: NetworkQuality, downlink: NetworkQuality) => void
  handleRoomBinaryMessageReceived: (event: { userId: string; message: ArrayBuffer }) => void

  // === 业务方法 ===
  setSelectedPersona: (persona: Persona) => void
  connectCall: (deviceId?: string) => Promise<void>
  disconnectCall: () => Promise<void>
  processSubtitleMessage: (message: Uint8Array) => void
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
  updateRealtimeSubtitle: (userId: string, subtitle: RealtimeSubtitle) => void
  clearRealtimeSubtitle: (userId: string) => void
  startAgent: () => Promise<void>
  stopAgent: () => Promise<void>
  reset: () => void
}

// 创建 zustand store
export const useVoiceChatStore = create<VoiceChatState>((set, get) => ({
  // 初始状态
  rtcAppId: env.NEXT_PUBLIC_RTC_APP_ID || "",
  rtcToken: env.NEXT_PUBLIC_RTC_TOKEN || "",
  rtcRoomId: env.NEXT_PUBLIC_RTC_ROOM_ID || "Room123",
  userId: env.NEXT_PUBLIC_RTC_USER_ID || "User123",

  personas: defaultPersonas,
  selectedPersona: null,

  callState: CallState.IDLE,
  audioStatus: {
    isConnected: false,
    isMicrophoneOn: false,
    isSpeakerOn: false,
    isProcessing: false,
  },
  error: null,
  taskId: null,
  isAgentActive: false,

  audioLevel: 0,
  isMuted: false,
  isRecording: false,

  messages: [],
  realtimeSubtitles: new Map(),

  isServicesInitialized: false,
  playStatus: {},

  // 初始化服务
  initializeServices: async () => {
    try {
      const { rtcAppId } = get()

      // 调试环境变量
      logger.info("Environment variables:", {
        rtcAppId: env.NEXT_PUBLIC_RTC_APP_ID,
        rtcToken: env.NEXT_PUBLIC_RTC_TOKEN, 
        rtcRoomId: env.NEXT_PUBLIC_RTC_ROOM_ID,
        userId: env.NEXT_PUBLIC_RTC_USER_ID,
      })

      if (!rtcAppId) {
        throw new Error("RTC App ID not configured")
      }

      // 初始化 RTC 引擎
      await rtcClient.initialize(rtcAppId)

      logger.info("Voice chat services initialized")

      set({ isServicesInitialized: true })
    } catch (error) {
      logger.error("Failed to initialize services", error)
      set({ error: error as Error })
    }
  },

  // 处理 RTC 错误事件
  handleError: (e: { errorCode: typeof VERTC.ErrorCode }) => {
    const { errorCode } = e
    logger.error("RTC 错误:", errorCode)
    toast.error(`RTC 连接错误: ${errorCode}`)

    set({
      callState: CallState.ERROR,
      error: new Error(`RTC Error: ${errorCode}`),
    })
  },

  // 处理用户加入事件
  handleUserJoin: (e: onUserJoinedEvent) => {
    const userId = e.userInfo.userId
    logger.info(`用户加入房间: ${userId}`)

    // 可以在这里添加用户加入的业务逻辑
  },

  // 处理用户离开事件
  handleUserLeave: (e: onUserLeaveEvent) => {
    const userId = e.userInfo.userId
    logger.info(`用户离开房间: ${userId}`)
  },

  // 处理用户发布流事件
  handleUserPublishStream: (e: { userId: string; mediaType: MediaType }) => {
    const { userId, mediaType } = e
    logger.info(`用户开始发布流: ${userId}, 媒体类型: ${mediaType}`)
  },

  // 处理用户取消发布流事件
  handleUserUnpublishStream: (e: { userId: string; mediaType: MediaType; reason: StreamRemoveReason }) => {
    const { userId, mediaType, reason } = e
    logger.info(`用户停止发布流: ${userId}, 媒体类型: ${mediaType}, 原因: ${reason}`)
  },

  // 处理本地音频属性报告事件
  handleLocalAudioPropertiesReport: (e: LocalAudioPropertiesInfo[]) => {
    const localAudioInfo = e.find((audioInfo) => audioInfo.streamIndex === StreamIndex.STREAM_INDEX_MAIN)

    if (localAudioInfo) {
      const audioLevel = localAudioInfo.audioPropertiesInfo.linearVolume
      set({ audioLevel })

      // 如果音量超过阈值且正在录音，表示用户在说话
      if (audioLevel > 0.1 && get().isRecording) {
        set({ callState: CallState.SPEAKING })
      }
    }
  },

  // 处理远端音频属性报告事件
  handleRemoteAudioPropertiesReport: (e: RemoteAudioPropertiesInfo[]) => {
    const remoteAudioInfo = e.filter((audioInfo) => audioInfo.streamKey.streamIndex === StreamIndex.STREAM_INDEX_MAIN)

    // 处理远端音频音量信息
    remoteAudioInfo.forEach((audioInfo) => {
      const { userId } = audioInfo.streamKey
      const audioLevel = audioInfo.audioPropertiesInfo.linearVolume

      if (audioLevel > 0.1 && userId.includes("ai")) {
        set({ callState: CallState.LISTENING })
      }
    })
  },

  // 处理音频设备状态变化事件
  handleAudioDeviceStateChanged: async (device: DeviceInfo) => {
    logger.info("音频设备状态变化:", device)

    if (device.mediaDeviceInfo.kind === "audioinput") {
      // 可以在这里处理音频输入设备变化
      toast.info(`音频输入设备状态变化: ${device.mediaDeviceInfo.label}`)
    }
  },

  // 处理自动播放失败事件
  handleAutoPlayFail: (event: AutoPlayFailedEvent) => {
    logger.error("自动播放失败:", event)
    toast.error("音频自动播放失败，请手动播放")
  },

  // 处理播放器事件
  handlePlayerEvent: (event: PlayerEvent) => {
    logger.info("播放器事件:", event)
  },

  // 处理用户开始音频采集事件
  handleUserStartAudioCapture: (e: { userId: string }) => {
    const userId = e.userId
    logger.info(`用户开始音频采集: ${userId}`)
  },

  // 处理用户停止音频采集事件
  handleUserStopAudioCapture: (e: { userId: string }) => {
    const userId = e.userId
    logger.info(`用户停止音频采集: ${userId}`)
  },

  // 处理网络质量事件
  handleNetworkQuality: (uplinkNetworkQuality: NetworkQuality, downlinkNetworkQuality: NetworkQuality) => {
    const averageQuality = Math.floor((uplinkNetworkQuality + downlinkNetworkQuality) / 2)
    logger.debug(`网络质量更新: ${averageQuality}`)

    if (averageQuality === NetworkQuality.BAD) {
      toast.warning("网络质量较差，可能影响通话质量")
    }
  },

  // 处理房间二进制消息事件
  handleRoomBinaryMessageReceived: (event: { userId: string; message: ArrayBuffer }) => {
    logger.info("收到房间二进制消息:", { userId: event.userId, size: event.message.byteLength })

    try {
      // 解析二进制消息为字幕数据
      if (event.message && event.message instanceof ArrayBuffer) {
        // 调用字幕处理方法
        get().processSubtitleMessage(new Uint8Array(event.message))
        logger.info("成功处理字幕消息")
      } else {
        logger.warn("二进制消息格式不正确, 期望 ArrayBuffer")
      }
    } catch (error) {
      logger.error("处理房间二进制消息失败:", error)
      toast.error("字幕处理失败")
    }
  },

  // 设置选中的人设
  setSelectedPersona: (persona: Persona) => {
    set({ selectedPersona: persona })
    logger.info(`Selected persona: ${persona.name}`)
  },

  // 连接通话
  connectCall: async (deviceId?: string) => {
    try {
      const { rtcToken, rtcRoomId, userId, selectedPersona, rtcAppId, startAgent } = get()

      if (!selectedPersona) {
        throw new Error("No persona selected")
      }

      // 更新状态为连接中
      set({ callState: CallState.CONNECTING })


      const listeners = {
        handleError: get().handleError,
        handleUserJoin: get().handleUserJoin,
        handleUserLeave: get().handleUserLeave,
        handleUserPublishStream: get().handleUserPublishStream,
        handleUserUnpublishStream: get().handleUserUnpublishStream,
        handleLocalAudioPropertiesReport: get().handleLocalAudioPropertiesReport,
        handleRemoteAudioPropertiesReport: get().handleRemoteAudioPropertiesReport,
        handleAudioDeviceStateChanged: get().handleAudioDeviceStateChanged,
        handleAutoPlayFail: get().handleAutoPlayFail,
        handlePlayerEvent: get().handlePlayerEvent,
        handleUserStartAudioCapture: get().handleUserStartAudioCapture,
        handleUserStopAudioCapture: get().handleUserStopAudioCapture,
        handleNetworkQuality: get().handleNetworkQuality,
        handleRoomBinaryMessageReceived: get().handleRoomBinaryMessageReceived,
      }

      rtcClient.registerEventListeners(listeners)
      logger.info("RTC 事件监听器已注册")

      // 加入 RTC 房间，传入当前选择的麦克风设备ID
      await rtcClient.connect({
        appId: rtcAppId,
        roomId: rtcRoomId,
        userId: userId,
        token: rtcToken,
        isAutoPublish: true,
        isAutoSubscribeAudio: true,
        isAutoSubscribeVideo: false,
      })

      if (!deviceId) {
      logger.warn("No device selected")
      } else {
        await rtcClient.publishVoiceStream(deviceId)
      }

      // 启动智能体
      await startAgent()

      set({ callState: CallState.CONNECTED })

      logger.info("Connected to voice call")
    } catch (error) {
      logger.error("Failed to connect call", error)
      set({
        callState: CallState.ERROR,
        error: error as Error,
      })
    }
  },

  // 断开通话
  disconnectCall: async () => {
    try {
      set({ callState: CallState.DISCONNECTING })

      // 停止智能体
      await get().stopAgent()
      
      // 离开 RTC 房间
      await rtcClient.disconnect()



      // 更新状态
      set({
        callState: CallState.IDLE,
      })

      logger.info("Disconnected from voice call")
    } catch (error) {
      logger.error("Failed to disconnect call", error)
      set({
        callState: CallState.ERROR,
        error: error as Error,
      })
    }
  },

  // 处理字幕消息
  processSubtitleMessage: (message: Uint8Array) => {
    try {
      const subtitleDataArray = SubtitleParser.parseSubtitleMessage(message)

      if (!subtitleDataArray || subtitleDataArray.length === 0) {
        logger.warn("字幕解析失败或数据为空")
        return
      }

      // 处理每一条字幕数据
      subtitleDataArray.forEach((subtitleData) => {
        const { userId, text, sequence, definite, paragraph } = subtitleData

        // 更新实时字幕
        const currentSubtitle: RealtimeSubtitle = {
          userId,
          text,
          sequence,
          isComplete: definite && paragraph,
          timestamp: Date.now(),
        }

        get().updateRealtimeSubtitle(userId, currentSubtitle)

        // 如果是完整句子，添加到聊天记录
        if (SubtitleParser.isCompleteSentence(subtitleData)) {
          const isUser = SubtitleParser.isUserMessage(userId)
          const chatMessage: Omit<ChatMessage, "id" | "timestamp"> = {
            role: isUser ? "user" : "assistant",
            content: text,
            isFromSubtitle: true,
            subtitleData,
          }

          get().addChatMessage(chatMessage)

          // 清除该用户的实时字幕
          get().clearRealtimeSubtitle(userId)

          logger.info(`添加聊天记录: ${isUser ? "用户" : "AI"} - ${text}`)
        }
      })
    } catch (error) {
      logger.error("处理字幕消息失败", error)
      set({ error: error as Error })
    }
  },

  // 添加聊天记录
  addChatMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => {
    set((state) => {
      const newMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        ...message,
      }

      state.messages.push(newMessage)

      return state
    })
  },

  // 更新实时字幕
  updateRealtimeSubtitle: (userId: string, subtitle: RealtimeSubtitle) => {
    set((state) => {
      state.realtimeSubtitles.set(userId, subtitle)

      return state
    })
  },

  // 清除实时字幕
  clearRealtimeSubtitle: (userId: string) => {
    set((state) => {
      state.realtimeSubtitles.delete(userId)

      return state
    })
  },

  // 启动智能体
  startAgent: async () => {
    try {

      // todo: 
      await stopVoiceChatAction({ TaskId: "User123" })

      const { selectedPersona, rtcAppId, rtcRoomId, userId } = get()

      if (!selectedPersona) {
        throw new Error("No persona selected")
      }

      logger.info("启动智能体...", { persona: selectedPersona.name, appId: rtcAppId, roomId: rtcRoomId })

      // 调用 Server Action 启动智能体
      const result = await startVoiceChatAction({
        appId: rtcAppId,
        roomId: rtcRoomId,
        personaId: selectedPersona.id,
        userId: userId,
      })

      if (!result.success) {
        throw new Error(result.error || "启动智能体失败")
      }

      set({
        taskId: result.taskId,
        isAgentActive: true,
      })

      logger.info("智能体启动成功", { taskId: result.taskId })
    } catch (error) {
      logger.error("智能体启动失败", error)
      set({ error: error as Error })
      throw error // 重新抛出错误以便上层处理
    }
  },

  // 停止智能体
  stopAgent: async () => {
    try {
      const { taskId } = get()

      if (!taskId) {
        logger.warn("没有运行中的智能体任务")
        return
      }

      logger.info("停止智能体...", { taskId })

      // 调用 Server Action 停止智能体
      const result = await stopVoiceChatAction({ TaskId: taskId })

      if (!result.success) {
        throw new Error(result.error || "停止智能体失败")
      }

      set({
        taskId: null,
        isAgentActive: false,
      })

      logger.info("智能体停止成功")
    } catch (error) {
      logger.error("智能体停止失败", error)
      set({ error: error as Error })
    }
  },

  // 重置所有状态
  reset: () => {
    // 先断开现有连接
    if (
      get().callState === CallState.CONNECTED ||
      get().callState === CallState.SPEAKING ||
      get().callState === CallState.LISTENING
    ) {
      rtcClient.disconnect()
    }

    // 重置到初始状态
    set({
      callState: CallState.IDLE,
      audioStatus: {
        isConnected: false,
        isMicrophoneOn: false,
        isSpeakerOn: false,
        isProcessing: false,
      },
      error: null,
      messages: [],
      realtimeSubtitles: new Map(),
      isMuted: false,
      taskId: null,
      isAgentActive: false,
      isServicesInitialized: false,
    })

    logger.info("Voice chat state reset")
  },
}))
