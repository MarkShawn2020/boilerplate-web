"use client"

import { logger } from './logger'

export interface DoubaoConfig {
  apiKey: string
  apiSecret?: string
  apiEndpoint?: string
}

export interface TTSOptions {
  text: string
  voiceId?: string
  speed?: number
  pitch?: number
}

export interface STTOptions {
  audioBlob: Blob
  language?: string
}

export type DoubaoEvents = {
  onSTTResult?: (text: string) => void
  onTTSStart?: () => void
  onTTSEnd?: () => void
  onError?: (error: Error) => void
}

/**
 * 豆包AI服务
 * 提供语音识别(STT)和语音合成(TTS)功能
 */
export class DoubaoService {
  private static instance: DoubaoService | null = null
  private config: DoubaoConfig | null = null
  private events: DoubaoEvents = {}
  private audioContext: AudioContext | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying: boolean = false

  private constructor() {
    logger.info('DoubaoService 初始化', { module: 'DoubaoService' })
  }

  /**
   * 获取DoubaoService单例
   */
  public static getInstance(): DoubaoService {
    if (!DoubaoService.instance) {
      DoubaoService.instance = new DoubaoService()
    }
    return DoubaoService.instance
  }

  /**
   * 初始化服务
   * @param config 豆包API配置
   * @param events 事件回调
   */
  public init(config: DoubaoConfig, events: DoubaoEvents = {}): void {
    this.config = config
    this.events = events
    
    // 初始化Web Audio API
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      logger.info('Web Audio API 已初始化', { module: 'DoubaoService' })
    } catch (error) {
      logger.error('Web Audio API 初始化失败', { 
        module: 'DoubaoService',
        error: error as Error
      })
      this.handleError(error as Error)
    }
  }

  /**
   * 语音识别 (STT - Speech to Text)
   * 将音频转换为文本
   * @param options STT选项
   */
  public async speechToText(options: STTOptions): Promise<string> {
    if (!this.config || !this.config.apiKey) {
      const error = new Error('DoubaoService未初始化或缺少API密钥')
      this.handleError(error)
      return Promise.reject(error)
    }

    try {
      logger.info('开始语音识别', { module: 'DoubaoService' })
      
      // 创建表单数据
      const formData = new FormData()
      formData.append('audio', options.audioBlob)
      formData.append('api_key', this.config.apiKey)
      if (options.language) {
        formData.append('language', options.language)
      }
      
      // 调用豆包API进行语音识别
      // 注意：此处为临时实现，实际项目中应从环境变量获取API端点
      const endpoint = this.config.apiEndpoint || 'https://api.doubao.com/v1/speech/recognize'
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          // 如果需要其他认证头部
          ...(this.config.apiSecret ? { 'Authorization': `Bearer ${this.config.apiSecret}` } : {})
        }
      })
      
      if (!response.ok) {
        throw new Error(`语音识别请求失败: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json() as { text?: string }
      const text = result.text || ''
      
      // 触发STT结果事件
      this.events.onSTTResult?.(text)
      logger.info('语音识别完成', { module: 'DoubaoService', data: { text } })
      
      return text
    } catch (error) {
      logger.error('语音识别失败', { 
        module: 'DoubaoService',
        error: error as Error
      })
      this.handleError(error as Error)
      return Promise.reject(error)
    }
  }

  /**
   * 文本转语音 (TTS - Text to Speech)
   * @param options TTS选项
   */
  public async textToSpeech(options: TTSOptions): Promise<void> {
    if (!this.config || !this.config.apiKey || !this.audioContext) {
      const error = new Error('DoubaoService未初始化或缺少API密钥')
      this.handleError(error)
      return Promise.reject(error)
    }

    try {
      logger.info('开始文本转语音', { 
        module: 'DoubaoService',
        data: { text: options.text.substring(0, 50) + (options.text.length > 50 ? '...' : '') }
      })
      
      // 触发TTS开始事件
      this.events.onTTSStart?.()
      
      // 准备请求参数
      const params = new URLSearchParams({
        text: options.text,
        api_key: this.config.apiKey,
        ...(options.voiceId ? { voice_id: options.voiceId } : {}),
        ...(options.speed ? { speed: options.speed.toString() } : {}),
        ...(options.pitch ? { pitch: options.pitch.toString() } : {})
      })
      
      // 调用豆包API进行文本转语音
      const endpoint = this.config.apiEndpoint || 'https://api.doubao.com/v1/speech/synthesize'
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
        headers: {
          ...(this.config.apiSecret ? { 'Authorization': `Bearer ${this.config.apiSecret}` } : {})
        }
      })
      
      if (!response.ok) {
        throw new Error(`文本转语音请求失败: ${response.status} ${response.statusText}`)
      }
      
      // 获取音频数据并播放
      const audioData = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(audioData)
      
      // 将音频加入播放队列
      this.audioQueue.push(audioBuffer)
      
      // 如果当前没有播放，开始播放
      if (!this.isPlaying) {
        this.playNextInQueue()
      }
      
      logger.info('文本转语音成功，已加入播放队列', { module: 'DoubaoService' })
    } catch (error) {
      logger.error('文本转语音失败', { 
        module: 'DoubaoService',
        error: error as Error
      })
      this.handleError(error as Error)
      return Promise.reject(error)
    }
  }

  /**
   * 播放队列中的下一个音频
   */
  private playNextInQueue(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false
      this.events.onTTSEnd?.()
      return
    }

    this.isPlaying = true
    const audioBuffer = this.audioQueue.shift()!
    
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)
    
    // 播放结束后处理下一个
    source.onended = () => {
      this.playNextInQueue()
    }
    
    // 开始播放
    source.start(0)
  }

  /**
   * 停止所有播放
   */
  public stopPlayback(): void {
    this.audioQueue = []
    if (this.audioContext) {
      // 重新创建AudioContext以停止所有当前播放
      this.audioContext.close().then(() => {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      })
    }
    this.isPlaying = false
    this.events.onTTSEnd?.()
    logger.info('已停止所有音频播放', { module: 'DoubaoService' })
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    this.events.onError?.(error)
  }
}
