"use client";

import { useEffect, useRef, useCallback } from 'react';
import VERTC, {
  LocalAudioPropertiesInfo,
  RemoteAudioPropertiesInfo,
  MediaType,
  onUserJoinedEvent,
  onUserLeaveEvent,
  StreamRemoveReason,
  StreamIndex,
  DeviceInfo,
  AutoPlayFailedEvent,
  PlayerEvent,
  NetworkQuality,
} from '@volcengine/rtc';

import { useVoiceChatStore, CallState } from '../store/voice-chat-store';
import { rtcEngineService } from '../services/rtc-engine';
import { logger } from '../services/logger';
import { toast } from 'sonner';

export interface VoiceChatListeners {
  handleError: (e: { errorCode: typeof VERTC.ErrorCode }) => void;
  handleUserJoin: (e: onUserJoinedEvent) => void;
  handleUserLeave: (e: onUserLeaveEvent) => void;
  handleUserPublishStream: (e: { userId: string; mediaType: MediaType }) => void;
  handleUserUnpublishStream: (e: { userId: string; mediaType: MediaType; reason: StreamRemoveReason }) => void;
  handleLocalAudioPropertiesReport: (e: LocalAudioPropertiesInfo[]) => void;
  handleRemoteAudioPropertiesReport: (e: RemoteAudioPropertiesInfo[]) => void;
  handleAudioDeviceStateChanged: (device: DeviceInfo) => void;
  handleAutoPlayFail: (event: AutoPlayFailedEvent) => void;
  handlePlayerEvent: (event: PlayerEvent) => void;
  handleUserStartAudioCapture: (e: { userId: string }) => void;
  handleUserStopAudioCapture: (e: { userId: string }) => void;
  handleNetworkQuality: (uplink: NetworkQuality, downlink: NetworkQuality) => void;
  handleRoomBinaryMessageReceived: (event: { userId: string; message: ArrayBuffer }) => void;
}

/**
 * useVoiceChat Hook
 * 基于火山引擎 RTC SDK 的语音对话 Hook
 * 提供完整的 RTC 事件监听和状态管理
 */
export const useVoiceChat = (): {
  listeners: VoiceChatListeners;
  audioLevel: number;
  isConnected: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  switchDevice: (deviceId: string) => Promise<void>;
} => {
  // 获取全局状态管理
  const {
    callState,
    audioStatus,
    selectedPersona,
    isMuted,
    messages,
    sendMessage,
    processSubtitleMessage,
    isServicesInitialized
  } = useVoiceChatStore();

  // 本地状态管理
  const audioLevelRef = useRef<number>(0);
  const playStatusRef = useRef<{ [key: string]: { audio: boolean } }>({});
  const recordingRef = useRef<boolean>(false);

  // 错误处理
  const handleError = useCallback((e: { errorCode: typeof VERTC.ErrorCode }) => {
    const { errorCode } = e;
    logger.error('RTC 错误:', errorCode);
    
    if (errorCode === VERTC.ErrorCode.DUPLICATE_LOGIN) {
      toast.error('重复登录，已被踢出房间');
    } else {
      toast.error(`RTC 连接错误: ${errorCode}`);
    }
  }, []);

  // 用户加入处理
  const handleUserJoin = useCallback((e: onUserJoinedEvent) => {
    const userId = e.userInfo.userId;
    logger.info(`用户加入房间: ${userId}`);
    
    // 如果是 AI 用户加入，更新状态
    if (selectedPersona && userId.includes('ai')) {
      useVoiceChatStore.setState({ callState: CallState.CONNECTED });
      
      // 发送欢迎消息
      const welcomeMessage = `你好，我是${selectedPersona.name}，很高兴与你交谈。`;
      useVoiceChatStore.setState({
        messages: [...messages, { role: 'assistant', content: welcomeMessage }]
      });
    }
  }, [selectedPersona, messages]);

  // 用户离开处理
  const handleUserLeave = useCallback((e: onUserLeaveEvent) => {
    const userId = e.userInfo.userId;
    logger.info(`用户离开房间: ${userId}`);
    
    // 清理播放状态
    delete playStatusRef.current[userId];
  }, []);

  // 音频流发布处理
  const handleUserPublishStream = useCallback((e: { userId: string; mediaType: MediaType }) => {
    const { userId, mediaType } = e;
    logger.info(`用户开始发布流: ${userId}, 媒体类型: ${mediaType}`);
    
    if (mediaType === MediaType.AUDIO) {
      // 如果是 AI 用户发布音频流，表示 AI 开始说话
      if (userId.includes('ai')) {
        useVoiceChatStore.setState({ callState: CallState.SPEAKING });
      }
    }
  }, []);

  // 音频流取消发布处理
  const handleUserUnpublishStream = useCallback((e: { 
    userId: string; 
    mediaType: MediaType; 
    reason: StreamRemoveReason 
  }) => {
    const { userId, mediaType, reason } = e;
    logger.info(`用户停止发布流: ${userId}, 媒体类型: ${mediaType}, 原因: ${reason}`);
    
    if (mediaType === MediaType.AUDIO && userId.includes('ai')) {
      useVoiceChatStore.setState({ callState: CallState.LISTENING });
    }
  }, []);

  // 本地音频属性报告
  const handleLocalAudioPropertiesReport = useCallback((e: LocalAudioPropertiesInfo[]) => {
    const localAudioInfo = e.find(
      (audioInfo) => audioInfo.streamIndex === StreamIndex.STREAM_INDEX_MAIN
    );
    
    if (localAudioInfo) {
      const audioLevel = localAudioInfo.audioPropertiesInfo.linearVolume;
      audioLevelRef.current = audioLevel;
      
      // 如果音量超过阈值且正在录音，表示用户在说话
      if (audioLevel > 0.1 && recordingRef.current) {
        useVoiceChatStore.setState({ callState: CallState.SPEAKING });
      }
    }
  }, []);

  // 远端音频属性报告
  const handleRemoteAudioPropertiesReport = useCallback((e: RemoteAudioPropertiesInfo[]) => {
    const remoteAudioInfo = e.filter(
      (audioInfo) => audioInfo.streamKey.streamIndex === StreamIndex.STREAM_INDEX_MAIN
    );
    
    // 处理远端音频音量信息
    remoteAudioInfo.forEach((audioInfo) => {
      const { userId } = audioInfo.streamKey;
      const audioLevel = audioInfo.audioPropertiesInfo.linearVolume;
      
      if (audioLevel > 0.1 && userId.includes('ai')) {
        useVoiceChatStore.setState({ callState: CallState.LISTENING });
      }
    });
  }, []);

  // 音频设备状态变化
  const handleAudioDeviceStateChanged = useCallback(async (device: DeviceInfo) => {
    logger.info('音频设备状态变化:', device);
    
    if (device.mediaDeviceInfo.kind === 'audioinput') {
      if (device.deviceState === 'inactive') {
        toast.warning('当前麦克风设备已断开，正在切换到其他设备');
        
        // 获取可用设备并切换
        const devices = await rtcEngineService.getAvailableDevices();
        if (devices.audioInputs.length > 0) {
          await rtcEngineService.switchAudioDevice(devices.audioInputs[0].deviceId);
        }
      }
    }
  }, []);

  // 自动播放失败处理
  const handleAutoPlayFail = useCallback((event: AutoPlayFailedEvent) => {
    const { userId, kind } = event;
    logger.warn(`自动播放失败: ${userId}, 类型: ${kind}`);
    
    let playUser = playStatusRef.current[userId] || {};
    playUser = { ...playUser, [kind]: false };
    playStatusRef.current[userId] = playUser;
    
    toast.warning('音频播放失败，请点击页面激活音频播放');
  }, []);

  // 播放器事件处理
  const handlePlayerEvent = useCallback((event: PlayerEvent) => {
    const { userId, rawEvent, type } = event;
    let playUser = playStatusRef.current[userId] || {};
    
    if (rawEvent.type === 'playing') {
      playUser = { ...playUser, [type]: true };
    } else if (rawEvent.type === 'pause') {
      playUser = { ...playUser, [type]: false };
    }
    
    playStatusRef.current[userId] = playUser;
  }, []);

  // 用户开始音频采集
  const handleUserStartAudioCapture = useCallback((e: { userId: string }) => {
    const { userId } = e;
    logger.info(`用户开始音频采集: ${userId}`);
    
    if (userId.includes('ai')) {
      useVoiceChatStore.setState({ callState: CallState.SPEAKING });
    }
  }, []);

  // 用户停止音频采集
  const handleUserStopAudioCapture = useCallback((e: { userId: string }) => {
    const { userId } = e;
    logger.info(`用户停止音频采集: ${userId}`);
    
    if (userId.includes('ai')) {
      useVoiceChatStore.setState({ callState: CallState.LISTENING });
    }
  }, []);

  // 网络质量变化
  const handleNetworkQuality = useCallback((
    uplinkNetworkQuality: NetworkQuality,
    downlinkNetworkQuality: NetworkQuality
  ) => {
    const averageQuality = Math.floor((uplinkNetworkQuality + downlinkNetworkQuality) / 2);
    logger.debug(`网络质量更新: ${averageQuality}`);
    
    if (averageQuality === NetworkQuality.BAD) {
      toast.warning('网络质量较差，可能影响通话质量');
    }
  }, []);

  // 房间二进制消息接收（字幕消息）
  const handleRoomBinaryMessageReceived = useCallback((event: { userId: string; message: ArrayBuffer }) => {
    console.log('📡 [DEBUG] 收到二进制消息:', event.userId, event.message.byteLength, 'bytes');
    logger.info('收到房间二进制消息:', { userId: event.userId, size: event.message.byteLength });
    
    try {
      // 解析二进制消息为字幕数据
      if (event.message && event.message instanceof ArrayBuffer) {
        // 调用状态管理中的字幕处理方法
        processSubtitleMessage(new Uint8Array(event.message));
        logger.info('成功处理字幕消息');
      } else {
        logger.warn('二进制消息格式不正确, 期望 ArrayBuffer');
      }
    } catch (error) {
      logger.error('处理房间二进制消息失败:', error);
      toast.error('字幕处理失败');
    }
  }, [processSubtitleMessage]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      recordingRef.current = true;
      await rtcEngineService.startAudioCapture();
      useVoiceChatStore.setState({ callState: CallState.LISTENING });
      logger.info('开始录音');
    } catch (error) {
      logger.error('开始录音失败:', error);
      toast.error('开始录音失败');
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(async () => {
    try {
      recordingRef.current = false;
      
      // 模拟发送用户语音消息到 AI
      if (audioLevelRef.current > 0.1) {
        const userMessage = "用户语音输入"; // 实际应该是 STT 的结果
        await sendMessage(userMessage);
      }
      
      useVoiceChatStore.setState({ callState: CallState.THINKING });
      logger.info('停止录音');
    } catch (error) {
      logger.error('停止录音失败:', error);
      toast.error('停止录音失败');
    }
  }, [sendMessage]);

  // 切换音频设备
  const switchDevice = useCallback(async (deviceId: string) => {
    try {
      await rtcEngineService.switchAudioDevice(deviceId);
      logger.info(`切换音频设备: ${deviceId}`);
    } catch (error) {
      logger.error('切换音频设备失败:', error);
      toast.error('切换音频设备失败');
    }
  }, []);

  // 注册事件监听器 - 需要等待 RTC Engine 初始化完成
  useEffect(() => {
    // 检查服务是否已初始化
    if (!isServicesInitialized) {
      logger.debug('服务尚未初始化，跳过事件监听器注册');
      return;
    }

    const listeners = {
      handleError,
      handleUserJoin,
      handleUserLeave,
      handleUserPublishStream,
      handleUserUnpublishStream,
      handleLocalAudioPropertiesReport,
      handleRemoteAudioPropertiesReport,
      handleAudioDeviceStateChanged,
      handleAutoPlayFail,
      handlePlayerEvent,
      handleUserStartAudioCapture,
      handleUserStopAudioCapture,
      handleNetworkQuality,
      handleRoomBinaryMessageReceived,
    };

    // 注册所有事件监听器
    rtcEngineService.registerEventListeners(listeners);
    logger.info('[useVoiceChat] External event listeners registered');

    return () => {
      // 清理事件监听器
      rtcEngineService.unregisterEventListeners();
      logger.info('[useVoiceChat] External event listeners unregistered');
    };
  }, [
    handleError,
    handleUserJoin,
    handleUserLeave,
    handleUserPublishStream,
    handleUserUnpublishStream,
    handleLocalAudioPropertiesReport,
    handleRemoteAudioPropertiesReport,
    handleAudioDeviceStateChanged,
    handleAutoPlayFail,
    handlePlayerEvent,
    handleUserStartAudioCapture,
    handleUserStopAudioCapture,
    handleNetworkQuality,
    handleRoomBinaryMessageReceived,
    isServicesInitialized
  ]);

  return {
    listeners: {
      handleError,
      handleUserJoin,
      handleUserLeave,
      handleUserPublishStream,
      handleUserUnpublishStream,
      handleLocalAudioPropertiesReport,
      handleRemoteAudioPropertiesReport,
      handleAudioDeviceStateChanged,
      handleAutoPlayFail,
      handlePlayerEvent,
      handleUserStartAudioCapture,
      handleUserStopAudioCapture,
      handleNetworkQuality,
      handleRoomBinaryMessageReceived,
    },
    audioLevel: audioLevelRef.current,
    isConnected: callState === CallState.CONNECTED || callState === CallState.SPEAKING || callState === CallState.LISTENING,
    startRecording,
    stopRecording,
    switchDevice,
  };
};

export default useVoiceChat;
