import { useEffect } from 'react';
import { useVoiceChatStore } from '../store/voice-chat-store';
import { CallState } from '../store/voice-chat-store';
import { logger } from '../lib/logger';

/**
 * 语音对话 Hook - 简化的接口包装器
 * 职责：
 * 1. 为组件提供清晰的业务接口
 * 2. 管理 RTC 事件监听器的生命周期
 * 3. 暴露必要的状态和方法给组件
 */
export const useVoiceChat = () => {
  const store = useVoiceChatStore();

  // 初始化 RTC 事件监听器（仅在服务初始化后）
  useEffect(() => {
    if (!store.isServicesInitialized) {
      logger.debug("服务未初始化，等待初始化完成");
      return;
    }

    logger.info("初始化 RTC 事件监听器");
    store.initializeRTCListeners();

    // 清理函数：组件卸载时清理事件监听器
    return () => {
      logger.info("清理 RTC 事件监听器");
      store.cleanupRTCListeners();
    };
  }, [store.isServicesInitialized, store.initializeRTCListeners, store.cleanupRTCListeners]);

  // 计算派生状态
  const isConnected = store.callState !== CallState.IDLE && store.callState !== CallState.ERROR;
  const isActive = store.callState === CallState.SPEAKING || store.callState === CallState.LISTENING;

  return {
    // === 状态暴露 ===
    audioLevel: store.audioLevel,
    isConnected,
    isActive,
    isRecording: store.isRecording,
    isMuted: store.isMuted,
    callState: store.callState,
    error: store.error,

    // === 音频控制方法 ===
    startRecording: store.startRecording,
    stopRecording: store.stopRecording,
    switchDevice: store.switchDevice,
    toggleMute: store.toggleMute,

    // === 通话控制方法 ===
    connectCall: store.connectCall,
    disconnectCall: store.disconnectCall,

    // === 消息相关方法 ===
    sendMessage: store.sendMessage,
    messages: store.messages,

    // === 人设相关 ===
    selectedPersona: store.selectedPersona,
    setSelectedPersona: store.setSelectedPersona,

    // === 智能体控制 ===
    startAgent: store.startAgent,
    stopAgent: store.stopAgent,
    isAgentActive: store.isAgentActive,

    // === 字幕相关 ===
    realtimeSubtitles: store.realtimeSubtitles,
  };
};

export default useVoiceChat;
