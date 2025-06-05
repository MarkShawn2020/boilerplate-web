"use client";

import { create } from 'zustand';
import { rtcEngineService, AudioStatus } from '../services/rtc-engine';
import { aiService, AIMessage } from '../services/ai-service';
import { logger } from '../services/logger';
import { defaultPersonas } from 'data/personas';
import { env } from '../env.mjs';

// 人设接口
export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar: string;
  voiceId?: string;
  systemPrompt?: string;
}

// 对话状态枚举
export enum CallState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SPEAKING = 'speaking',
  LISTENING = 'listening',
  THINKING = 'thinking',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error',
}

// 语音对话存储状态
export interface VoiceChatState {
  // 用户配置
  rtcAppId: string;
  rtcToken: string;
  rtcRoomId: string;
  userId: string;
  
  // 人设相关
  personas: Persona[];
  selectedPersona: Persona | null;
  
  // 通话状态
  callState: CallState;
  audioStatus: AudioStatus;
  error: Error | null;
  
  // 对话记录
  messages: AIMessage[];
  
  // 设置/配置
  isAutoConnect: boolean;
  isMuted: boolean;
  
  // 操作方法
  initializeServices: () => Promise<void>;
  setSelectedPersona: (persona: Persona) => void;
  connectCall: () => Promise<void>;
  disconnectCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  reset: () => void;
}

// 创建 zustand store
export const useVoiceChatStore = create<VoiceChatState>((set, get) => ({
  // 初始状态
  rtcAppId: env.NEXT_PUBLIC_RTC_APP_ID || '',
  rtcToken: env.NEXT_PUBLIC_RTC_TOKEN || '',
  rtcRoomId: env.NEXT_PUBLIC_RTC_ROOM_ID || 'Room123',
  userId: env.NEXT_PUBLIC_RTC_USER_ID || 'User123',
  
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
  
  messages: [],
  
  isAutoConnect: false,
  isMuted: false,
  
  // 初始化服务
  initializeServices: async () => {
    try {
      const { rtcAppId } = get();
      
      // 调试环境变量
      logger.info('Environment variables:', {
        rtcAppId: env.NEXT_PUBLIC_RTC_APP_ID,
        rtcToken: env.NEXT_PUBLIC_RTC_TOKEN ? 'SET' : 'NOT_SET',
        rtcRoomId: env.NEXT_PUBLIC_RTC_ROOM_ID,
        userId: env.NEXT_PUBLIC_RTC_USER_ID,
      });
      
      if (!rtcAppId) {
        throw new Error('RTC App ID not configured');
      }
      
      // 初始化 RTC 引擎
      rtcEngineService.initialize(rtcAppId);
      
      logger.info('Voice chat services initialized');
    } catch (error) {
      logger.error('Failed to initialize services', error);
      set({ error: error as Error });
    }
  },
  
  // 设置选中的人设
  setSelectedPersona: (persona: Persona) => {
    set({ selectedPersona: persona });
    logger.info(`Selected persona: ${persona.name}`);
  },
  
  // 连接通话
  connectCall: async () => {
    try {
      const { rtcToken, rtcRoomId, userId, selectedPersona } = get();
      
      if (!selectedPersona) {
        throw new Error('No persona selected');
      }
      
      // 更新状态为连接中
      set({ callState: CallState.CONNECTING });
      
      // 加入 RTC 房间
      await rtcEngineService.joinRoom({
        appId: get().rtcAppId,
        roomId: rtcRoomId,
        userId: userId,
        token: rtcToken,
        isAutoPublish: true,
        isAutoSubscribeAudio: true,
        isAutoSubscribeVideo: false,
      });
      
      // 开始音频采集
      await rtcEngineService.startAudioCapture();
      
      // 更新状态
      set({
        callState: CallState.CONNECTED,
        audioStatus: rtcEngineService.getAudioStatus(),
        messages: [
          {
            role: 'system',
            content: selectedPersona.systemPrompt || `你是${selectedPersona.name}，请用友好的语气交流`
          },
          {
            role: 'assistant',
            content: `你好，我是${selectedPersona.name}，很高兴与你交谈。`
          }
        ],
      });
      
      logger.info('Connected to voice call');
    } catch (error) {
      logger.error('Failed to connect call', error);
      set({
        callState: CallState.ERROR,
        error: error as Error
      });
    }
  },
  
  // 断开通话
  disconnectCall: async () => {
    try {
      set({ callState: CallState.DISCONNECTING });
      
      // 离开 RTC 房间
      await rtcEngineService.leaveRoom();
      
      // 更新状态
      set({
        callState: CallState.IDLE,
        audioStatus: rtcEngineService.getAudioStatus(),
      });
      
      logger.info('Disconnected from voice call');
    } catch (error) {
      logger.error('Failed to disconnect call', error);
      set({
        callState: CallState.ERROR,
        error: error as Error
      });
    }
  },
  
  // 切换静音状态
  toggleMute: async () => {
    try {
      const newIsMuted = !get().isMuted;
      
      if (newIsMuted) {
        await rtcEngineService.stopAudioCapture();
      } else {
        await rtcEngineService.startAudioCapture();
      }
      
      set({
        isMuted: newIsMuted,
        audioStatus: rtcEngineService.getAudioStatus(),
      });
      
      logger.info(`Microphone ${newIsMuted ? 'muted' : 'unmuted'}`);
    } catch (error) {
      logger.error('Failed to toggle mute', error);
      set({ error: error as Error });
    }
  },
  
  // 发送消息
  sendMessage: async (content: string) => {
    try {
      const { messages, selectedPersona } = get();
      const userMessage: AIMessage = { role: 'user', content };
      
      // 添加用户消息到对话历史
      set({
        messages: [...messages, userMessage],
        callState: CallState.THINKING,
      });
      
      // 准备发送到豆包 AI
      const conversation = [...messages, userMessage];
      
      // 调用 AI 服务获取回复
      const response = await aiService.sendConversation({
        messages: conversation,
        personaId: selectedPersona?.id,
      });
      
      // 添加 AI 回复到对话历史
      set({
        messages: [...get().messages, response.message],
        callState: CallState.CONNECTED,
      });
      
      logger.info('Received AI response');
    } catch (error) {
      logger.error('Failed to send message', error);
      set({
        callState: CallState.ERROR,
        error: error as Error
      });
    }
  },
  
  // 重置所有状态
  reset: () => {
    // 先断开现有连接
    if (get().callState === CallState.CONNECTED || 
        get().callState === CallState.SPEAKING || 
        get().callState === CallState.LISTENING) {
      rtcEngineService.leaveRoom().catch(err => {
        logger.error('Error during reset/disconnect', err);
      });
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
      isMuted: false,
    });
    
    logger.info('Voice chat state reset');
  }
}));

// 初始化语音对话
export const initializeVoiceChat = async () => {
  await useVoiceChatStore.getState().initializeServices();
};
