"use client";

import React from 'react';
import { cn } from '../../lib/utils';

interface VolumeVisualizerProps {
  volume: number; // 0-1 之间的音量值
  isActive?: boolean;
  className?: string;
  variant?: 'bars' | 'wave' | 'circle';
  size?: 'sm' | 'md' | 'lg';
}

export const VolumeVisualizer: React.FC<VolumeVisualizerProps> = ({
  volume,
  isActive = false,
  className,
  variant = 'bars',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-16 h-8',
    md: 'w-24 h-12',
    lg: 'w-32 h-16',
  };

  // 条形图可视化
  const BarsVisualizer: React.FC = () => {
    const barCount = 8;
    const bars = Array.from({ length: barCount }, (_, i) => {
      const height = Math.max(0.1, volume * (0.5 + Math.random() * 0.5));
      const isHighlighted = i < Math.floor(volume * barCount);
      
      return (
        <div
          key={i}
          className={cn(
            "w-1 bg-gray-300 rounded-full transition-all duration-75",
            isActive && isHighlighted && volume > 0.1 && "bg-green-500",
            isActive && volume > 0.7 && isHighlighted && "bg-red-500",
            isActive && volume > 0.4 && volume <= 0.7 && isHighlighted && "bg-yellow-500"
          )}
          style={{
            height: `${height * 100}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      );
    });

    return (
      <div className={cn("flex items-end justify-center space-x-1 h-full", sizeClasses[size])}>
        {bars}
      </div>
    );
  };

  // 波形可视化
  const WaveVisualizer: React.FC = () => {
    const points = 20;
    const waveData = Array.from({ length: points }, (_, i) => {
      const x = (i / (points - 1)) * 100;
      const baseY = 50;
      const amplitude = volume * 30;
      const frequency = 2;
      const phase = isActive ? Date.now() * 0.01 : 0;
      const y = baseY + Math.sin((i * frequency + phase) * 0.5) * amplitude;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className={cn("relative", sizeClasses[size])}>
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={waveData}
            fill="none"
            stroke={
              isActive && volume > 0.1
                ? volume > 0.7
                  ? "#ef4444"
                  : volume > 0.4
                  ? "#eab308"
                  : "#10b981"
                : "#d1d5db"
            }
            strokeWidth="2"
            className="transition-colors duration-75"
          />
        </svg>
      </div>
    );
  };

  // 圆形可视化
  const CircleVisualizer: React.FC = () => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (volume * circumference);

    return (
      <div className={cn("relative flex items-center justify-center", sizeClasses[size])}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 50 50">
          {/* 背景圆 */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="2"
          />
          {/* 音量圆 */}
          <circle
            cx="25"
            cy="25"
            r={radius}
            fill="none"
            stroke={
              isActive && volume > 0.1
                ? volume > 0.7
                  ? "#ef4444"
                  : volume > 0.4
                  ? "#eab308"
                  : "#10b981"
                : "#d1d5db"
            }
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-75"
          />
        </svg>
        
        {/* 中心点 */}
        <div
          className={cn(
            "absolute w-2 h-2 rounded-full transition-colors duration-75",
            isActive && volume > 0.1
              ? volume > 0.7
                ? "bg-red-500"
                : volume > 0.4
                ? "bg-yellow-500"
                : "bg-green-500"
              : "bg-gray-400",
            isActive && volume > 0.1 && "animate-pulse"
          )}
        />
      </div>
    );
  };

  const renderVisualizer = () => {
    switch (variant) {
      case 'wave':
        return <WaveVisualizer />;
      case 'circle':
        return <CircleVisualizer />;
      case 'bars':
      default:
        return <BarsVisualizer />;
    }
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {renderVisualizer()}
    </div>
  );
};
