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
import React, { useState } from 'react';

import { useMicrophone } from '../../hooks/useMicrophone';
import { cn } from '../../lib/utils';

interface MicrophoneControlProps {
  className?: string;
  onRecordingStart?: (stream: MediaStream) => void;
  onRecordingStop?: () => void;
  onError?: (error: Error) => void;
}

export const MicrophoneControl: React.FC<MicrophoneControlProps> = ({
  className,
  onRecordingStart,
  onRecordingStop,
  onError,
}) => {
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    await switchDevice(deviceId);
    setIsDeviceMenuOpen(false);
  };

  // 处理权限请求
  const handleRequestPermission = async () => {
    await checkPermission();
    await getDevices();
  };

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
    <div className="relative">
      <button
        onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        disabled={!hasDevices}
      >
        <span className="truncate max-w-40">
          {selectedDevice?.label || 'Default Device'}
        </span>
        <ChevronDown className="h-4 w-4" />
      </button>
      
      {isDeviceMenuOpen && hasDevices && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-2">Select Microphone</div>
            {devices.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => handleDeviceSwitch(device.deviceId)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between",
                  selectedDevice?.deviceId === device.deviceId
                    ? "bg-blue-50 text-blue-700"
                    : "hover:bg-gray-50"
                )}
              >
                <span className="truncate">{device.label}</span>
                {selectedDevice?.deviceId === device.deviceId && (
                  <CheckCircle className="h-4 w-4" />
                )}
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
      {/* 主控制面板 */}
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center space-x-4">
          {/* 录音按钮 */}
          <button
            onClick={handleToggleRecording}
            disabled={!isPermissionGranted}
            className={cn(
              "p-3 rounded-full transition-all duration-200",
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700",
              !isPermissionGranted && "opacity-50 cursor-not-allowed"
            )}
          >
            {isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          {/* 静音按钮 */}
          {isActive && (
            <button
              onClick={toggleMute}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isMuted
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {isMuted ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}

          {/* 状态指示器 */}
          <StatusIndicator />
        </div>

        {/* 设置按钮 */}
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* 音量指示器 */}
      {isActive && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <VolumeIndicator />
        </div>
      )}

      {/* 设置面板 */}
      {isSettingsOpen && (
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
      )}

      {/* 错误显示 */}
      <ErrorDisplay />
    </div>
  );
};
