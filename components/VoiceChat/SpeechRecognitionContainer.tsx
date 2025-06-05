"use client";

import React from 'react';
import { useSpeechRecognition } from '../../services/speech-recognition';
import { SpeechIndicator } from '../speech/SpeechIndicator';
import { ConversationDisplay } from '../speech/ConversationDisplay';
import { useVoiceChatStore, CallState } from '../../store/voice-chat-store';
import { logger } from '../../services/logger';

interface SpeechRecognitionContainerProps {
  className?: string;
}

/**
 * 语音识别集成容器 - 将语音识别和对话显示组件集成在一起
 */
export function SpeechRecognitionContainer({ className }: SpeechRecognitionContainerProps) {
  // 获取语音识别状态
  const { 
    transcript, 
    isInterim, 
    isListening, 
    isSpeaking,
    volume // 获取实时音量数据
  } = useSpeechRecognition();
  
  // 获取通话状态
  const { callState } = useVoiceChatStore();

  // 记录状态变化
  React.useEffect(() => {
    logger.debug('语音识别状态变更:', {
      isListening,
      isSpeaking,
      currentTranscript: transcript,
      callState,
      currentVolume: volume
    });
  }, [isListening, isSpeaking, transcript, callState, volume]);

  // 只有在连接状态或监听状态时才显示转写文本
  const shouldShowTranscript = 
    callState === CallState.CONNECTED || 
    callState === CallState.LISTENING;

  // 当前显示的转写文本
  const displayTranscript = shouldShowTranscript && isListening ? transcript : '';

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* 对话历史和实时转写 */}
      <ConversationDisplay 
        currentTranscript={displayTranscript}
        className="flex-grow"
      />
      
      {/* 语音状态指示器 */}
      <SpeechIndicator volume={volume} />
    </div>
  );
}

export default SpeechRecognitionContainer;
