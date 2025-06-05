"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useVoiceChatStore, CallState } from '../store/voice-chat-store';
import { logger } from './logger';

/**
 * 语音识别配置选项
 */
export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

/**
 * 语音识别状态
 */
export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  isInterim: boolean;
  confidence: number;
}

/**
 * 音量检测配置
 */
export interface VolumeDetectionOptions {
  threshold: number;
  smoothingTimeConstant: number;
}

/**
 * 语音识别服务 - 提供实时语音转写和音量检测功能
 */
export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private volumeCallback: ((volume: number) => void) | null = null;
  private volumeDetectionId: number | null = null;
  private options: SpeechRecognitionOptions;

  constructor(options: SpeechRecognitionOptions = {}) {
    this.options = {
      language: 'zh-CN',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      ...options
    };

    // 创建语音识别实例
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || 
                                  (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.configureRecognition();
      } else {
        logger.error('语音识别API不受支持');
      }
    }
  }

  /**
   * 配置语音识别实例
   */
  private configureRecognition(): void {
    if (!this.recognition) return;

    const { language, continuous, interimResults, maxAlternatives } = this.options;

    this.recognition.lang = language || 'zh-CN';
    this.recognition.continuous = continuous !== false;
    this.recognition.interimResults = interimResults !== false;
    this.recognition.maxAlternatives = maxAlternatives || 1;
  }

  /**
   * 启动语音识别
   * @param onResult 结果回调
   * @param onError 错误回调
   */
  public startRecognition(
    onResult: (transcript: string, isFinal: boolean, confidence: number) => void,
    onError?: (error: any) => void
  ): void {
    if (!this.recognition) {
      logger.error('语音识别不可用');
      return;
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const resultIndex = event.resultIndex;
      const results = event.results;
      
      for (let i = resultIndex; i < results.length; i++) {
        const result = results[i];
        if (!result) continue;
        
        const alternative = result[0];
        if (!alternative) continue;
        
        const transcript = alternative.transcript || '';
        const isFinal = !!result.isFinal;
        const confidence = alternative.confidence || 0;
        
        onResult(transcript, isFinal, confidence);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error('语音识别错误:', event);
      if (onError) onError(event);
    };

    try {
      this.recognition.start();
      logger.info('语音识别已启动');
    } catch (error) {
      logger.error('启动语音识别失败:', error);
      if (onError) onError(error);
    }
  }

  /**
   * 停止语音识别
   */
  public stopRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
        logger.info('语音识别已停止');
      } catch (error) {
        logger.error('停止语音识别失败:', error);
      }
    }
  }

  /**
   * 初始化音量检测
   * @param callback 音量回调
   * @param options 音量检测选项
   */
  public async initVolumeDetection(
    callback: (volume: number) => void,
    options: VolumeDetectionOptions = { threshold: 0.1, smoothingTimeConstant: 0.5 }
  ): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      logger.error('麦克风访问API不受支持');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;
      this.analyser.smoothingTimeConstant = options.smoothingTimeConstant;
      this.analyser.fftSize = 1024;
      
      this.microphone.connect(this.analyser);
      this.volumeCallback = callback;
      
      this.startVolumeDetection(options.threshold);
      logger.info('音量检测已初始化');
      return true;
    } catch (error) {
      logger.error('初始化音量检测失败:', error);
      return false;
    }
  }

  /**
   * 启动音量检测
   * @param threshold 音量阈值
   */
  private startVolumeDetection(threshold: number): void {
    if (!this.analyser || !this.volumeCallback) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const detectVolume = () => {
      this.analyser!.getByteFrequencyData(dataArray);
      
      // 计算音量平均值并规范化到 0-1 范围
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] || 0; // 添加 undefined 检查
      }
      const average = sum / dataArray.length;
      const normalizedVolume = average / 255;
      
      if (this.volumeCallback) {
        this.volumeCallback(normalizedVolume);
      }
      
      this.volumeDetectionId = requestAnimationFrame(detectVolume);
    };
    
    this.volumeDetectionId = requestAnimationFrame(detectVolume);
  }

  /**
   * 停止音量检测
   */
  public stopVolumeDetection(): void {
    if (this.volumeDetectionId) {
      cancelAnimationFrame(this.volumeDetectionId);
      this.volumeDetectionId = null;
    }
    
    if (this.audioContext && this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    this.volumeCallback = null;
    logger.info('音量检测已停止');
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stopRecognition();
    this.stopVolumeDetection();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(error => {
        logger.error('关闭音频上下文失败:', error);
      });
    }
    
    this.audioContext = null;
    this.analyser = null;
    this.recognition = null;
  }
}

// 创建单例实例
export const speechRecognitionService = new SpeechRecognitionService();

/**
 * 语音识别Hook - 提供React组件使用的语音识别功能
 */
export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    isInterim: false,
    confidence: 0
  });
  const [volume, setVolume] = useState(0);
  const [isSpeakingDetected, setIsSpeakingDetected] = useState(false);
  
  const { callState, sendMessage } = useVoiceChatStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');

  // 处理语音识别结果
  const handleRecognitionResult = useCallback((transcript: string, isFinal: boolean, confidence: number) => {
    setState(prev => ({
      ...prev,
      transcript,
      isInterim: !isFinal,
      confidence
    }));
    
    // 如果是最终结果，并且有内容，则发送消息
    if (isFinal && transcript.trim() !== '') {
      finalTranscriptRef.current = transcript;
      
      // 设置延迟，等待用户停止说话后再发送消息
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        logger.info('发送识别的文本:', finalTranscriptRef.current);
        sendMessage(finalTranscriptRef.current);
        setState(prev => ({ ...prev, transcript: '' }));
        finalTranscriptRef.current = '';
      }, 1000);
    }
  }, [sendMessage]);

  // 处理音量检测
  const handleVolumeChange = useCallback((currentVolume: number) => {
    setVolume(currentVolume);
    
    // 使用阈值判断是否正在说话
    const threshold = 0.05; // 根据实际情况调整阈值
    const isSpeaking = currentVolume > threshold;
    
    setIsSpeakingDetected(isSpeaking);
  }, []);

  // 启动语音识别和音量检测
  const startListening = useCallback(async () => {
    if (state.isListening) return;
    
    // 初始化音量检测
    const volumeInitialized = await speechRecognitionService.initVolumeDetection(handleVolumeChange);
    
    if (!volumeInitialized) {
      logger.error('无法初始化音量检测');
      return;
    }
    
    // 启动语音识别
    speechRecognitionService.startRecognition(
      handleRecognitionResult,
      (error) => {
        logger.error('语音识别错误:', error);
      }
    );
    
    setState(prev => ({ ...prev, isListening: true }));
    logger.info('开始监听语音');
  }, [state.isListening, handleRecognitionResult, handleVolumeChange]);

  // 停止语音识别和音量检测
  const stopListening = useCallback(() => {
    if (!state.isListening) return;
    
    speechRecognitionService.stopRecognition();
    speechRecognitionService.stopVolumeDetection();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isListening: false,
      transcript: ''
    }));
    
    setVolume(0);
    setIsSpeakingDetected(false);
    logger.info('停止监听语音');
  }, [state.isListening]);

  // 处理组件挂载和卸载
  useEffect(() => {
    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      stopListening();
    };
  }, [stopListening]);

  // 根据通话状态自动管理语音识别
  useEffect(() => {
    if (callState === CallState.CONNECTED || callState === CallState.LISTENING) {
      startListening();
    } else {
      stopListening();
    }
  }, [callState, startListening, stopListening]);

  return {
    isListening: state.isListening,
    transcript: state.transcript,
    isInterim: state.isInterim,
    confidence: state.confidence,
    volume,
    isSpeaking: isSpeakingDetected,
    startListening,
    stopListening
  };
}
