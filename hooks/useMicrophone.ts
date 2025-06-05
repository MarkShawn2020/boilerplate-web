"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../services/logger';

// 音频设备接口
export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

// 音量级别
export interface VolumeLevel {
  current: number;
  peak: number;
  rms: number;
}

// 麦克风状态
export interface MicrophoneState {
  isSupported: boolean;
  isPermissionGranted: boolean;
  isActive: boolean;
  isMuted: boolean;
  isMonitoring: boolean;
  devices: AudioDevice[];
  selectedDevice: AudioDevice | null;
  volumeLevel: VolumeLevel;
  error: Error | null;
}

// 麦克风 Hook
export const useMicrophone = () => {
  const [state, setState] = useState<MicrophoneState>({
    isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
    isPermissionGranted: false,
    isActive: false,
    isMuted: false,
    isMonitoring: false,
    devices: [],
    selectedDevice: null,
    volumeLevel: { current: 0, peak: 0, rms: 0 },
    error: null,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeTimerRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // 检查麦克风权限
  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.isSupported) {
        throw new Error('Media devices not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      setState(prev => ({ ...prev, isPermissionGranted: true, error: null }));
      logger.info('Microphone permission granted');
      return true;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ 
        ...prev, 
        isPermissionGranted: false, 
        error: new Error(`Permission denied: ${err.message}`) 
      }));
      logger.error('Microphone permission denied', error);
      return false;
    }
  }, [state.isSupported]);

  // 获取音频设备列表
  const getDevices = useCallback(async (): Promise<AudioDevice[]> => {
    try {
      if (!state.isSupported) {
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId}`,
          kind: device.kind as 'audioinput',
        }));

      setState(prev => ({ ...prev, devices: audioDevices }));
      logger.info(`Found ${audioDevices.length} audio input devices`);
      return audioDevices;
    } catch (error) {
      logger.error('Failed to get audio devices', error);
      setState(prev => ({ ...prev, error: error as Error }));
      return [];
    }
  }, [state.isSupported]);

  // 初始化音频分析器
  const initializeAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      // 创建音频上下文
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioContext = audioContextRef.current;

      // 创建音频源
      const source = audioContext.createMediaStreamSource(stream);
      
      // 创建分析器
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      
      // 连接音频源到分析器
      source.connect(analyserRef.current);
      
      // 初始化数据数组
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      logger.info('Audio analyzer initialized');
    } catch (error) {
      logger.error('Failed to initialize audio analyzer', error);
    }
  }, []);

  // 分析音量级别
  const analyzeVolume = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return;
    }

    try {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // 计算 RMS 和峰值
      let sum = 0;
      let peak = 0;
      
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const value = dataArrayRef.current[i];
        if (value !== undefined) {
          sum += value * value;
          peak = Math.max(peak, value);
        }
      }
      
      const rms = Math.sqrt(sum / dataArrayRef.current.length);
      const normalizedRms = rms / 255;
      const normalizedPeak = peak / 255;
      
      setState(prev => ({
        ...prev,
        volumeLevel: {
          current: normalizedRms,
          peak: normalizedPeak,
          rms: normalizedRms,
        },
      }));
    } catch (error) {
      logger.error('Failed to analyze volume', error);
    }
  }, []);

  // 开始音量监测
  const startVolumeMonitoring = useCallback(() => {
    if (volumeTimerRef.current) {
      return;
    }

    const monitor = () => {
      analyzeVolume();
      volumeTimerRef.current = requestAnimationFrame(monitor);
    };
    
    monitor();
  }, [analyzeVolume]);

  // 停止音量监测
  const stopVolumeMonitoring = useCallback(() => {
    if (volumeTimerRef.current) {
      cancelAnimationFrame(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      volumeLevel: { current: 0, peak: 0, rms: 0 },
    }));
  }, []);

  // 停止音量监测（不影响录制状态）
  const stopVolumeMonitoringOnly = useCallback(() => {
    try {
      // // 停止音量监测
      // if (volumeTimerRef.current) {
      //   cancelAnimationFrame(volumeTimerRef.current);
      //   volumeTimerRef.current = null;
      // }
      
      // // 只有在不录制的情况下才关闭流
      // if (!state.isActive && mediaStreamRef.current) {
      //   mediaStreamRef.current.getTracks().forEach(track => track.stop());
      //   mediaStreamRef.current = null;
      // }

      setState(prev => ({ 
        ...prev, 
        isMonitoring: false,
        error: null 
      }));

      logger.info('Volume monitoring stopped');
    } catch (error) {
      logger.error('Failed to stop volume monitoring', error);
      setState(prev => ({ 
        ...prev, 
        error: error as Error 
      }));
    }
  }, [state.isActive]);

  // 开始音量监测（不录制，只监测）
  const startVolumeMonitoringOnly = useCallback(async (deviceId?: string): Promise<MediaStream | null> => {
    try {
      if (!state.isPermissionGranted) {
        const permitted = await checkPermission();
        if (!permitted) {
          return null;
        }
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // 初始化音频分析器（仅用于音量监测）
      initializeAudioAnalyzer(stream);
      
      // 开始音量监测
      if (!volumeTimerRef.current) {
        const monitor = () => {
          analyzeVolume();
          volumeTimerRef.current = requestAnimationFrame(monitor);
        };
        monitor();
      }

      setState(prev => ({ 
        ...prev, 
        isMonitoring: true, 
        isMuted: false, 
        error: null 
      }));

      logger.info('Volume monitoring started', { deviceId });
      return stream;
    } catch (error) {
      logger.error('Failed to start volume monitoring', error);
      setState(prev => ({ 
        ...prev, 
        isMonitoring: false, 
        error: error as Error 
      }));
      return null;
    }
  }, [state.isPermissionGranted, checkPermission, initializeAudioAnalyzer, analyzeVolume]);

  // 开始录音
  const startRecording = useCallback(async (deviceId?: string): Promise<MediaStream | null> => {
    try {
      if (!state.isPermissionGranted) {
        const permitted = await checkPermission();
        if (!permitted) {
          return null;
        }
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // 初始化音频分析器
      initializeAudioAnalyzer(stream);
      
      // 开始音量监测
      startVolumeMonitoring();

      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        isMuted: false, 
        error: null 
      }));

      logger.info('Recording started', { deviceId });
      return stream;
    } catch (error) {
      logger.error('Failed to start recording', error);
      setState(prev => ({ 
        ...prev, 
        isActive: false, 
        error: error as Error 
      }));
      return null;
    }
  }, [state.isPermissionGranted, checkPermission, initializeAudioAnalyzer, startVolumeMonitoring]);

  // 停止录音
  const stopRecording = useCallback(() => {
    try {
      // 停止媒体流
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // 关闭音频上下文
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // 停止音量监测
      stopVolumeMonitoring();

      setState(prev => ({ 
        ...prev, 
        isActive: false, 
        isMuted: false,
        error: null
      }));

      logger.info('Recording stopped');
    } catch (error) {
      logger.error('Failed to stop recording', error);
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, [stopVolumeMonitoring]);

  // 切换静音
  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) {
      return;
    }

    const audioTracks = mediaStreamRef.current.getAudioTracks();
    const newMutedState = !state.isMuted;

    audioTracks.forEach(track => {
      track.enabled = !newMutedState;
    });

    setState(prev => ({ ...prev, isMuted: newMutedState }));
    logger.info(`Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
  }, [state.isMuted]);

  // 切换设备
  const switchDevice = useCallback(async (deviceId: string) => {
    logger.info('Switch device requested', { deviceId });
    
    try {
      // 先更新选中的设备
      let targetDevice: AudioDevice | undefined;
      
      setState(prev => {
        targetDevice = prev.devices.find(device => device.deviceId === deviceId);
        if (!targetDevice) {
          logger.warn('Target device not found', { deviceId, availableDevices: prev.devices });
          return prev;
        }

        logger.info('Updating selected device', { 
          from: prev.selectedDevice?.label, 
          to: targetDevice.label 
        });
        
        return { ...prev, selectedDevice: targetDevice, error: null };
      });

      if (!targetDevice) {
        throw new Error(`Device with id ${deviceId} not found`);
      }

      // 如果当前在录音，需要重新启动录音以使用新设备
      const currentState = state;
      if (currentState.isActive) {
        logger.info('Restarting recording with new device', { deviceId });
        
        // 先停止当前录音
        stopRecording();
        
        // 等待一小段时间确保清理完成
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 使用新设备开始录音
        await startRecording(deviceId);
        
        logger.info('Successfully restarted recording with new device');
      }

    } catch (error) {
      logger.error('Failed to switch device', error);
      setState(prev => ({ 
        ...prev, 
        error: new Error(`Failed to switch device: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }));
      throw error; // 重新抛出错误以便上层处理
    }
  }, [stopRecording, startRecording, state]);

  // 初始化
  useEffect(() => {
    const initialize = async () => {
      if (state.isSupported) {
        await checkPermission();
        await getDevices();
      }
    };

    initialize();
  }, [state.isSupported, checkPermission, getDevices]);

  // 监听设备变化
  useEffect(() => {
    if (!state.isSupported) {
      return;
    }

    const handleDeviceChange = () => {
      getDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [state.isSupported, getDevices]);

  // 清理
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    ...state,
    // 方法
    checkPermission,
    getDevices,
    startRecording,
    stopRecording,
    toggleMute,
    switchDevice,
    startVolumeMonitoringOnly,
    stopVolumeMonitoringOnly,
    // 便捷属性
    hasDevices: state.devices.length > 0,
    volumePercentage: Math.round(state.volumeLevel.current * 100),
    isRecording: state.isActive && !state.isMuted,
  };
};
