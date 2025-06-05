"use client";

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Mic,
  MicOff,
  RefreshCw,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";

import { useMicrophone } from '../../hooks/useMicrophone';
import { cn } from '../../lib/utils';

interface MicrophoneControlProps {
  className?: string;
  onRecordingStart?: (stream: MediaStream) => void;
  onRecordingStop?: () => void;
  onError?: (error: Error) => void;
}

export function MicrophoneControl({ className, onRecordingStart, onRecordingStop, onError }: MicrophoneControlProps) {
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isSupported,
    isPermissionGranted,
    isActive,
    isMuted,
    devices,
    selectedDevice,
    error,
    hasDevices,
    volumePercentage,
    isRecording,
    checkPermission,
    getDevices,
    startRecording,
    stopRecording,
    toggleMute,
    switchDevice,
  } = useMicrophone();

  // 处理录音开始/停止
  const handleToggleRecording = async () => {
    try {
      if (isActive) {
        stopRecording();
        onRecordingStop?.();
      } else {
        const stream = await startRecording(selectedDevice?.deviceId);
        if (stream) {
          onRecordingStart?.(stream);
        }
      }
    } catch (err) {
      onError?.(err as Error);
    }
  };

  // 处理设备切换
  const handleDeviceSwitch = async (deviceId: string) => {
    if (isSwitching) return; // 防止重复点击
    
    setIsSwitching(true);
    try {
      const targetDevice = devices.find(d => d.deviceId === deviceId);
      console.log('Attempting to switch device:', { deviceId, targetDevice });
      
      await switchDevice(deviceId);
      setIsDeviceMenuOpen(false);
      
      // 成功反馈
      toast.success(`已切换到: ${targetDevice?.label || 'Unknown Device'}`);
      console.log(`Successfully switched to device: ${targetDevice?.label}`);
      
    } catch (error) {
      console.error('Failed to switch device:', error);
      toast.error(`设备切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
      onError?.(error as Error);
    } finally {
      setIsSwitching(false);
    }
  };

  // 处理权限请求
  const handleRequestPermission = async () => {
    await checkPermission();
    await getDevices();
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsDeviceMenuOpen(false);
      }
    };

    if (isDeviceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDeviceMenuOpen]);

  // 音量指示器
  const VolumeIndicator: React.FC = () => (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1">
        {volumePercentage > 0 ? (
          <Volume2 className="h-4 w-4 text-green-500" />
        ) : (
          <VolumeX className="h-4 w-4 text-gray-400" />
        )}
        <span className="text-xs text-gray-500">{volumePercentage}%</span>
      </div>
      
      {/* 音量条 */}
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-75 rounded-full",
            volumePercentage > 70 ? "bg-red-500" :
            volumePercentage > 40 ? "bg-yellow-500" :
            "bg-green-500"
          )}
          style={{ width: `${volumePercentage}%` }}
        />
      </div>
    </div>
  );

  // 设备选择菜单
  const DeviceMenu: React.FC = () => (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
        className={cn(
          "flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors",
          hasDevices 
            ? "bg-gray-100 hover:bg-gray-200" 
            : "bg-gray-50 text-gray-400 cursor-not-allowed"
        )}
        disabled={!hasDevices}
      >
        <span className="truncate max-w-40">
          {selectedDevice?.label || 'Default Device'}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          isDeviceMenuOpen ? "rotate-180" : ""
        )} />
      </button>
      
      {isDeviceMenuOpen && hasDevices && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2">Select Microphone</div>
            {devices.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => handleDeviceSwitch(device.deviceId)}
                disabled={isSwitching}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between",
                  isSwitching 
                    ? "opacity-50 cursor-not-allowed"
                    : selectedDevice?.deviceId === device.deviceId
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-50"
                )}
              >
                <span className="truncate">{device.label}</span>
                <div className="flex items-center space-x-1">
                  {isSwitching && device.deviceId !== selectedDevice?.deviceId && (
                    <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  )}
                  {selectedDevice?.deviceId === device.deviceId && !isSwitching && (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // 错误显示
  const ErrorDisplay: React.FC = () => {
    if (!error) return null;
    
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error.message}</span>
      </div>
    );
  };

  // 状态指示器
  const StatusIndicator: React.FC = () => (
    <div className="flex items-center space-x-2">
      <div className={cn(
        "w-2 h-2 rounded-full",
        isRecording ? "bg-green-500 animate-pulse" :
        isActive ? "bg-yellow-500" :
        "bg-gray-400"
      )} />
      <span className="text-xs text-gray-500">
        {isRecording ? 'Recording' :
         isActive ? 'Active' :
         'Inactive'}
      </span>
    </div>
  );

  if (!isSupported) {
    return (
      <div className={cn("p-4 bg-red-50 border border-red-200 rounded-lg", className)}>
        <div className="flex items-center space-x-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>Microphone not supported in this browser</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>

      {/* 音量指示器 */}

        <div className="p-3 bg-gray-50 rounded-lg">
          <VolumeIndicator />
        </div>


      {/* 设置面板 */}

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Microphone Settings</h3>
            <button
              onClick={getDevices}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* 权限状态 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Permission Status</span>
            <div className="flex items-center space-x-2">
              {isPermissionGranted ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Granted</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">Denied</span>
                  <button
                    onClick={handleRequestPermission}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Request
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 设备选择 */}
          {hasDevices && (
            <div className="space-y-2">
              <span className="text-sm text-gray-600">Select Device</span>
              <DeviceMenu />
            </div>
          )}

          {/* 设备列表 */}
          {devices.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-gray-600">Available Devices ({devices.length})</span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {devices.map((device, index) => (
                  <div
                    key={device.deviceId}
                    className="text-xs text-gray-500 truncate"
                  >
                    {index + 1}. {device.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* 错误显示 */}
      <ErrorDisplay />
    </div>
  );
};
