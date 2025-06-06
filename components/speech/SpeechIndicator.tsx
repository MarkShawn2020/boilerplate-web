"use client";

import React from 'react';
import { useVoiceChatStore, CallState } from '../../store/voice-chat-store';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';

// 音量波形动画组件
const AudioWaveform = ({ 
  active = false, 
  volume = 0, 
  className 
}: { 
  active?: boolean; 
  volume?: number; 
  className?: string 
}) => {
  // 波形条数量
  const barCount = 5;
  
  return (
    <div className={cn("flex items-center gap-1 h-4", className)}>
      {Array(barCount)
        .fill(0)
        .map((_, index) => {
          // 计算每个条的高度
          // 根据位置和音量调整高度，中间的条更高
          const baseHeight = 40; // 基础高度
          const positionFactor = 1 - Math.abs((index - (barCount - 1) / 2) / ((barCount - 1) / 2)); // 0到1，中间最高
          const randomFactor = active ? (Math.random() * 0.2) : 0; // 小幅随机变化
          
          // 根据音量和位置计算实际高度
          const heightPercent = active
            ? baseHeight + (volume * 60 * positionFactor) + (randomFactor * 100)
            : baseHeight;
            
          return (
            <div
              key={index}
              className={cn(
                "w-1 rounded-full transition-all duration-150",
                active 
                  ? "bg-primary" 
                  : "bg-muted"
              )}
              style={{
                height: `${Math.min(Math.max(heightPercent, 30), 100)}%`,
                transition: "height 100ms ease"
              }}
            />
          );
        })}
    </div>
  );
};

// 音量电平指示器
const VolumeMeter = ({ volume = 0 }: { volume: number }) => {
  // 计算填充条的宽度百分比
  const fillPercent = Math.min(volume * 100, 100);
  
  // 根据音量选择颜色
  const getVolumeColor = () => {
    if (volume > 0.8) return "bg-red-500";
    if (volume > 0.5) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <div className="w-full mt-1">
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-75", getVolumeColor())}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
};

interface SpeechIndicatorProps {
  className?: string;
  volume?: number; // 当前音量 0-1
}

export function SpeechIndicator({ className, volume = 0 }: SpeechIndicatorProps) {
  const { callState, isMuted, audioStatus } = useVoiceChatStore();
  
  // 判断是否正在说话(通过音量阈值在实际项目中实现)
  const isSpeaking = callState === CallState.LISTENING && !isMuted;
  
  // 判断是否正在等待AI回复
  const isThinking = callState === CallState.THINKING;
  
  // 判断AI是否正在说话
  const isAiSpeaking = callState === CallState.SPEAKING;

  logger.debug('SpeechIndicator 状态:', {
    callState,
    isMuted,
    isSpeaking,
    isThinking,
    isAiSpeaking,
    volume
  });
  
  if (isMuted) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-muted/30", className)}>
        <span className="text-muted-foreground">麦克风已静音</span>
      </div>
    );
  }
  
  if (isAiSpeaking) {
    return (
      <div className={cn("flex flex-col px-3 py-2 text-sm rounded-md bg-primary/10", className)}>
        <div className="flex items-center gap-2">
          <span className="text-primary">AI 正在说话</span>
          <AudioWaveform active={true} volume={0.5} />
        </div>
      </div>
    );
  }
  
  if (isThinking) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-amber-500/10", className)}>
        <span className="text-amber-500">AI 正在思考...</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col px-3 py-2 text-sm rounded-md transition-colors", 
        isSpeaking ? "bg-green-500/10" : "bg-muted/30",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className={isSpeaking ? "text-green-500" : "text-muted-foreground"}>
          {isSpeaking ? "正在听..." : "等待说话..."}
        </span>
        <AudioWaveform active={isSpeaking} volume={isSpeaking ? volume : 0} />
      </div>
      
      {/* 显示音量电平 */}
      {isSpeaking && <VolumeMeter volume={volume} />}
    </div>
  );
}

export default SpeechIndicator;
