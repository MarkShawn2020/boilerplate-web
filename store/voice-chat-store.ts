"use client";

import { create } from 'zustand';
import { rtcEngineService, AudioStatus } from '../services/rtc-engine';
import { aiService, AIMessage } from '../services/ai-service';
import { defaultPersonas } from 'data/personas';
import { env } from '../env.mjs';
import { RealtimeSubtitle, SubtitleParser } from '../lib/subtitle-parser';
import type { SubtitleData } from '../lib/subtitle-parser';
import { logger } from '../services/logger';
import { startVoiceChatAction, stopVoiceChatAction } from '../app/actions/voice-chat-actions';

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

// 扩展消息结构以支持字幕
export interface ChatMessage extends AIMessage {
  id: string;
  timestamp: number;
  isFromSubtitle?: boolean; // 是否来自字幕
  subtitleData?: SubtitleData; // 原始字幕数据
}

// 实时字幕状态
export interface RealtimeSubtitle {
  userId: string;
  text: string;
  sequence: number;
  isComplete: boolean; // 是否为完整句子
  timestamp: number;
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
  
  // 智能体任务状态
  taskId: string | null; // 智能体任务ID
  isAgentActive: boolean; // 智能体是否激活
  
  // 对话记录
  messages: ChatMessage[];
  
  // 实时字幕
  realtimeSubtitles: Map<string, RealtimeSubtitle>; // userId -> 当前实时字幕
  
  // 音频状态
  isMuted: boolean;
  
  // Actions
  initializeServices: () => Promise<void>;
  setSelectedPersona: (persona: Persona) => void;
  connectCall: () => Promise<void>;
  disconnectCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  processSubtitleMessage: (message: Uint8Array) => void; // 新增：处理字幕消息
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void; // 新增：添加聊天记录
  updateRealtimeSubtitle: (userId: string, subtitle: RealtimeSubtitle) => void; // 新增：更新实时字幕
  clearRealtimeSubtitle: (userId: string) => void; // 新增：清除实时字幕
  startAgent: () => Promise<void>; // 新增：启动智能体
  stopAgent: () => Promise<void>; // 新增：停止智能体
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
  
  taskId: null,
  isAgentActive: false,
  
  messages: [],
  
  realtimeSubtitles: new Map(),
  
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
      
      // 启动智能体
      await get().startAgent();
      
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
      
      // 停止智能体
      await get().stopAgent();
      
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
      const userMessage: ChatMessage = { role: 'user', content };
      
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
  
  // 处理字幕消息
  processSubtitleMessage: (message: Uint8Array) => {
    try {
      const subtitleDataArray = SubtitleParser.parseSubtitleMessage(message);
      
      if (!subtitleDataArray || subtitleDataArray.length === 0) {
        logger.warn('字幕解析失败或数据为空');
        return;
      }

      // 处理每一条字幕数据
      subtitleDataArray.forEach(subtitleData => {
        const { userId, text, sequence, definite, paragraph } = subtitleData;
        
        // 更新实时字幕
        const currentSubtitle: RealtimeSubtitle = {
          userId,
          text,
          sequence,
          isComplete: definite && paragraph,
          timestamp: Date.now(),
        };

        get().updateRealtimeSubtitle(userId, currentSubtitle);

        // 如果是完整句子，添加到聊天记录
        if (SubtitleParser.isCompleteSentence(subtitleData)) {
          const isUser = SubtitleParser.isUserMessage(userId);
          const chatMessage: Omit<ChatMessage, 'id' | 'timestamp'> = {
            role: isUser ? 'user' : 'assistant',
            content: text,
            isFromSubtitle: true,
            subtitleData,
          };

          get().addChatMessage(chatMessage);
          
          // 清除该用户的实时字幕
          get().clearRealtimeSubtitle(userId);
          
          logger.info(`添加聊天记录: ${isUser ? '用户' : 'AI'} - ${text}`);
        }
      });
      
    } catch (error) {
      logger.error('处理字幕消息失败', error);
      set({ error: error as Error });
    }
  },
  
  // 添加聊天记录
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    set((state) => {
      const newMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        ...message,
      };
      
      state.messages.push(newMessage);
      
      return state;
    });
  },
  
  // 更新实时字幕
  updateRealtimeSubtitle: (userId: string, subtitle: RealtimeSubtitle) => {
    set((state) => {
      state.realtimeSubtitles.set(userId, subtitle);
      
      return state;
    });
  },
  
  // 清除实时字幕
  clearRealtimeSubtitle: (userId: string) => {
    set((state) => {
      state.realtimeSubtitles.delete(userId);
      
      return state;
    });
  },
  
  // 启动智能体
  startAgent: async () => {
    try {
      const { selectedPersona, rtcAppId, rtcRoomId } = get();
      
      if (!selectedPersona) {
        throw new Error('No persona selected');
      }
      
      logger.info('启动智能体...', { persona: selectedPersona.name, appId: rtcAppId, roomId: rtcRoomId });
      
      // 调用 Server Action 启动智能体
      const result = await startVoiceChatAction({
        appId: rtcAppId,
        roomId: rtcRoomId,
        personaId: selectedPersona.id,
        userId: process.env.NEXT_PUBLIC_RTC_USER_ID || 'User123',
      });

      if (!result.success) {
        throw new Error(result.error || '启动智能体失败');
      }
      
      set({
        taskId: result.taskId,
        isAgentActive: true,
      });
      
      logger.info('智能体启动成功', { taskId: result.taskId });
    } catch (error) {
      logger.error('智能体启动失败', error);
      set({ error: error as Error });
      throw error; // 重新抛出错误以便上层处理
    }
  },
  
  // 停止智能体
  stopAgent: async () => {
    try {
      const { taskId } = get();
      
      if (!taskId) {
        logger.warn('没有运行中的智能体任务');
        return;
      }
      
      logger.info('停止智能体...', { taskId });
      
      // 调用 Server Action 停止智能体
      const result = await stopVoiceChatAction({ TaskId: taskId });

      if (!result.success) {
        throw new Error(result.error || '停止智能体失败');
      }
      
      set({
        taskId: null,
        isAgentActive: false,
      });
      
      logger.info('智能体停止成功');
    } catch (error) {
      logger.error('智能体停止失败', error);
      set({ error: error as Error });
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
      realtimeSubtitles: new Map(),
      isMuted: false,
      taskId: null,
      isAgentActive: false,
    });
    
    logger.info('Voice chat state reset');
  }
}));

// 初始化语音对话
export const initializeVoiceChat = async () => {
  await useVoiceChatStore.getState().initializeServices();
};
