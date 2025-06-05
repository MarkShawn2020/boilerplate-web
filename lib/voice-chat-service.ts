"use client"

import { logger } from './logger'
import { RTCService, RTCConfig, RTCEvents } from './rtc-service'
import { DoubaoService, DoubaoConfig, DoubaoEvents } from './doubao-service'

export interface VoiceChatConfig {
  rtc: RTCConfig
  doubao: DoubaoConfig
  persona?: {
    id: string
    name: string
    description: string
    voiceId?: string
  }
}

export interface VoiceChatEvents {
  onConnecting?: () => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
  onSpeaking?: (isSpeaking: boolean, userId?: string, audioLevel?: number) => void
  onAIMessage?: (message: string) => void
  onUserMessage?: (message: string) => void
}

export type VoiceChatState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'

// 音频录制配置
const AUDIO_RECORDER_OPTIONS = {
  audioBitsPerSecond: 128000,
  mimeType: 'audio/webm'
}

/**
 * 语音聊天服务
 * 整合RTC服务和豆包AI服务，提供完整的语音对话功能
 */
export class VoiceChatService {
  private static instance: VoiceChatService | null = null
  private rtcService: RTCService
  private doubaoService: DoubaoService
  private config: VoiceChatConfig | null = null
  private events: VoiceChatEvents = {}
  private state: VoiceChatState = 'idle'
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isMuted: boolean = false
  private conversationContext: any[] = [] // 对话上下文
  
  // 用于检测语音停顿的计时器
  private silenceTimer: NodeJS.Timeout | null = null
  private lastSpeakingTime: number = 0
  
  private constructor() {
    this.rtcService = RTCService.getInstance()
    this.doubaoService = DoubaoService.getInstance()
    logger.info('VoiceChatService 初始化', { module: 'VoiceChatService' })
  }

  /**
   * 获取VoiceChatService单例
   */
  public static getInstance(): VoiceChatService {
    if (!VoiceChatService.instance) {
      VoiceChatService.instance = new VoiceChatService()
    }
    return VoiceChatService.instance
  }

  /**
   * 初始化服务
   * @param config 配置
   * @param events 事件回调
   */
  public init(config: VoiceChatConfig, events: VoiceChatEvents = {}): void {
    this.config = config
    this.events = events
    
    logger.info('初始化语音聊天服务', { module: 'VoiceChatService' })
    
    // 初始化RTC服务
    const rtcEvents: RTCEvents = {
      onError: this.handleRTCError.bind(this),
      onJoinRoom: () => {
        this.setState('connected')
        this.startAudioCapture()
      },
      onLeaveRoom: () => {
        this.setState('idle')
      },
      onSpeaking: this.handleSpeakingEvent.bind(this)
    }
    this.rtcService.init(config.rtc, rtcEvents)
    
    // 初始化豆包AI服务
    const doubaoEvents: DoubaoEvents = {
      onSTTResult: this.handleSTTResult.bind(this),
      onTTSStart: () => {
        this.setState('speaking')
      },
      onTTSEnd: () => {
        if (this.state === 'speaking') {
          this.setState('connected')
        }
      },
      onError: this.handleDoubaoError.bind(this)
    }
    this.doubaoService.init(config.doubao, doubaoEvents)
  }

  /**
   * 连接语音对话
   */
  public async connect(): Promise<boolean> {
    if (!this.config) {
      this.handleError(new Error('未初始化配置'))
      return false
    }

    try {
      this.setState('connecting')
      logger.info('开始连接语音对话', { module: 'VoiceChatService' })
      
      // 加入RTC房间
      const joined = await this.rtcService.joinRoom()
      if (!joined) {
        throw new Error('加入房间失败')
      }
      
      // 启用音量监测
      this.rtcService.enableAudioVolumeIndication(200) // 200ms监测一次
      
      return true
    } catch (error) {
      this.handleError(error as Error)
      this.setState('error')
      return false
    }
  }

  /**
   * 断开语音对话
   */
  public async disconnect(): Promise<void> {
    logger.info('断开语音对话', { module: 'VoiceChatService' })
    
    // 停止录音
    this.stopRecording()
    
    // 停止所有音频播放
    this.doubaoService.stopPlayback()
    
    // 离开RTC房间
    await this.rtcService.leaveRoom()
    
    // 清理对话上下文
    this.conversationContext = []
    
    // 更新状态
    this.setState('idle')
  }

  /**
   * 开始音频采集和录制
   */
  private async startAudioCapture(): Promise<void> {
    try {
      // 开始RTC音频采集
      await this.rtcService.startAudio()
      
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 创建MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, AUDIO_RECORDER_OPTIONS)
      this.mediaRecorder.ondataavailable = this.handleAudioData.bind(this)
      this.mediaRecorder.start(1000) // 每秒收集一次数据
      
      logger.info('音频采集已启动', { module: 'VoiceChatService' })
    } catch (error) {
      logger.error('启动音频采集失败', { module: 'VoiceChatService', error: error as Error })
      this.handleError(error as Error)
    }
  }

  /**
   * 处理音频数据
   */
  private handleAudioData(event: BlobEvent): void {
    if (this.state !== 'listening' || this.isMuted) return

    // 收集音频数据
    if (event.data.size > 0) {
      this.audioChunks.push(event.data)
    }
    
    // 更新最后说话时间
    if (this.state === 'listening') {
      this.lastSpeakingTime = Date.now()
      
      // 重置停顿检测计时器
      this.resetSilenceTimer()
    }
  }

  /**
   * 重置停顿检测计时器
   */
  private resetSilenceTimer(): void {
    // 清除之前的计时器
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
    }
    
    // 1.5秒无发言视为一个语音输入结束
    this.silenceTimer = setTimeout(() => {
      this.processAudioInput()
    }, 1500)
  }

  /**
   * 处理音频输入
   */
  private async processAudioInput(): Promise<void> {
    if (this.audioChunks.length === 0) return

    try {
      logger.info('处理音频输入', { module: 'VoiceChatService' })
      
      // 合并音频数据
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
      this.audioChunks = [] // 重置音频数据
      
      // 音频转文字
      const text = await this.doubaoService.speechToText({ audioBlob })
      
      if (text.trim()) {
        // 发送至AI处理
        this.handleUserMessage(text)
      }
    } catch (error) {
      logger.error('处理音频输入失败', { module: 'VoiceChatService', error: error as Error })
    }
  }

  /**
   * 停止录音
   */
  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      
      // 释放麦克风
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      }
      
      this.mediaRecorder = null
      this.audioChunks = []
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }

  /**
   * 处理用户消息
   */
  private async handleUserMessage(message: string): Promise<void> {
    logger.info('收到用户消息', { 
      module: 'VoiceChatService',
      data: { message }
    })
    
    // 触发事件
    this.events.onUserMessage?.(message)
    
    // 添加到对话上下文
    this.conversationContext.push({
      role: 'user',
      content: message
    })
    
    // TODO: 调用豆包AI生成回复
    // 这里应该调用豆包API获取AI回复
    // 示例实现:
    setTimeout(() => {
      const aiResponse = `你好，我是AI助手，你刚才说的是: ${message}`
      this.handleAIResponse(aiResponse)
    }, 500)
  }

  /**
   * 处理AI响应
   */
  private async handleAIResponse(message: string): Promise<void> {
    logger.info('收到AI响应', { 
      module: 'VoiceChatService',
      data: { message }
    })
    
    // 触发事件
    this.events.onAIMessage?.(message)
    
    // 添加到对话上下文
    this.conversationContext.push({
      role: 'assistant',
      content: message
    })
    
    // 将文本转换为语音播放
    await this.doubaoService.textToSpeech({ 
      text: message,
      voiceId: this.config?.persona?.voiceId
    })
  }

  /**
   * 设置静音状态
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted
    logger.info(`已${muted ? '开启' : '关闭'}静音`, { module: 'VoiceChatService' })
  }

  /**
   * 获取当前静音状态
   */
  public getMuted(): boolean {
    return this.isMuted
  }

  /**
   * 更新服务状态
   */
  private setState(state: VoiceChatState): void {
    const previousState = this.state
    this.state = state
    
    logger.info(`状态变更: ${previousState} -> ${state}`, { module: 'VoiceChatService' })
    
    // 触发相应事件
    switch (state) {
      case 'connecting':
        this.events.onConnecting?.()
        break
      case 'connected':
        this.events.onConnected?.()
        break
      case 'idle':
        this.events.onDisconnected?.()
        break
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): VoiceChatState {
    return this.state
  }

  /**
   * 处理RTC错误
   */
  private handleRTCError(error: Error): void {
    logger.error('RTC错误', { module: 'VoiceChatService', error })
    this.handleError(error)
  }

  /**
   * 处理豆包AI错误
   */
  private handleDoubaoError(error: Error): void {
    logger.error('豆包AI错误', { module: 'VoiceChatService', error })
    this.handleError(error)
  }

  /**
   * 处理语音事件
   */
  private handleSpeakingEvent(userId: string, audioLevel: number): void {
    // 只在连接状态处理语音事件
    if (this.state !== 'connected' && this.state !== 'listening') return
    
    // 判断是否是当前用户，根据RTC设置的uid
    const isCurrentUser = userId === this.config?.rtc.uid
    
    if (isCurrentUser && audioLevel > 10 && !this.isMuted) {
      // 自己在说话，切换到listening状态
      if (this.state !== 'listening') {
        this.setState('listening')
      }
      
      this.lastSpeakingTime = Date.now()
      this.events.onSpeaking?.(true, userId, audioLevel)
    } else {
      // 远端用户在说话
      this.events.onSpeaking?.(true, userId, audioLevel)
    }
  }

  /**
   * 处理STT结果
   */
  private handleSTTResult(text: string): void {
    logger.info('语音识别结果', { module: 'VoiceChatService', data: { text } })
  }

  /**
   * 统一错误处理
   */
  private handleError(error: Error): void {
    logger.error('语音聊天服务错误', { module: 'VoiceChatService', error })
    this.events.onError?.(error)
  }
}
