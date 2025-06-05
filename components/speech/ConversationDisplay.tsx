"use client";

import React, { useEffect, useRef } from 'react';
import { useVoiceChatStore, CallState } from '../../store/voice-chat-store';
import { cn } from '../../lib/utils';
import { logger } from '../../services/logger';
import Image from 'next/image';

// 消息气泡组件
const MessageBubble = ({ 
  isUser, 
  content, 
  isLoading = false,
  avatar
}: { 
  isUser: boolean; 
  content: string;
  isLoading?: boolean;
  avatar?: string;
}) => {
  return (
    <div className={cn(
      "flex gap-3 mb-4",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
        {avatar && (
          <Image 
            src={avatar} 
            alt={isUser ? "用户" : "AI"}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        )}
      </div>

      <div className={cn(
        "max-w-[80%] rounded-lg p-3",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        <p className="whitespace-pre-wrap break-words">
          {content}
          {isLoading && (
            <span className="ml-1 inline-flex">
              <span className="animate-pulse">.</span>
              <span className="animate-pulse animation-delay-200">.</span>
              <span className="animate-pulse animation-delay-400">.</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

interface ConversationDisplayProps {
  className?: string;
  currentTranscript?: string; // 当前正在转写的文字
}

export function ConversationDisplay({ 
  className,
  currentTranscript 
}: ConversationDisplayProps) {
  const { messages, callState, selectedPersona } = useVoiceChatStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // 判断是否正在输入
  const isUserSpeaking = callState === CallState.LISTENING;
  
  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, currentTranscript]);

  logger.debug('ConversationDisplay 当前状态:', {
    messageCount: messages.length,
    currentTranscript,
    callState
  });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-y-auto p-4 h-[400px]",
        className
      )}
    >
      {messages.map((msg, index) => (
        <MessageBubble
          key={index}
          isUser={msg.role === 'user'}
          content={msg.content}
          avatar={msg.role === 'assistant' && selectedPersona ? selectedPersona.avatar : undefined}
        />
      ))}

      {/* 实时语音转文字显示 */}
      {isUserSpeaking && currentTranscript && currentTranscript.trim() !== '' && (
        <MessageBubble
          isUser={true}
          content={currentTranscript}
          isLoading={true}
        />
      )}

      {/* AI思考中的状态显示 */}
      {callState === CallState.THINKING && (
        <MessageBubble
          isUser={false}
          content="正在思考"
          isLoading={true}
          avatar={selectedPersona?.avatar}
        />
      )}
    </div>
  );
}

export default ConversationDisplay;
