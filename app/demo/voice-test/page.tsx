"use client";

import React, { useState } from 'react';
import { logger } from '@/services/logger';
import { CallState, Persona, useVoiceChatStore } from '@/store/voice-chat-store'; // 按字母顺序排序导入
import { SpeechRecognitionContainer } from '@/components/VoiceChat/SpeechRecognitionContainer';

/**
 * 语音识别测试页面
 * 展示实时音频强度和语音转文本功能
 */
export default function VoiceTestPage() {
  const { 
    callState, 
    initializeServices, 
    connectCall, 
    disconnectCall,
    personas,
    setSelectedPersona
  } = useVoiceChatStore();
  const [loading, setLoading] = useState(false);

  // 默认使用第一个人设（如果有的话），或创建一个测试人设
  const defaultPersona: Persona = {
    id: 'test-persona',
    name: '测试助手',
    description: '用于测试的AI助手',
    avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    systemPrompt: '你是一个有用的AI助手'
  };
  
  // 初始化和连接通话
  const handleStartCall = async () => {
    try {
      setLoading(true);
      
      logger.info('正在初始化语音服务...');
      await initializeServices();
      
      // 设置默认人设
      if (personas && personas.length > 0 && personas[0]) {
        const firstPersona = personas[0];
        logger.info('选择默认人设:', firstPersona.name);
        setSelectedPersona(firstPersona);
      } else {
        logger.info('使用测试人设:', defaultPersona.name);
        setSelectedPersona(defaultPersona);
      }
      
      logger.info('正在连接通话...');
      await connectCall();
      
      logger.info('连接成功，可以开始说话');
    } catch (error) {
      logger.error('连接失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 断开通话
  const handleEndCall = async () => {
    try {
      setLoading(true);
      
      logger.info('正在断开通话...');
      await disconnectCall();
      
      logger.info('通话已断开');
    } catch (error) {
      logger.error('断开失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 切换到监听状态 - 用于测试音量显示
  const handleStartListening = () => {
    logger.info('进入监听状态');
    // 直接更新store状态
    useVoiceChatStore.setState({ callState: CallState.LISTENING });
  };

  // 切换到 AI 说话状态
  const handleStartSpeaking = () => {
    logger.info('进入AI说话状态');
    useVoiceChatStore.setState({ callState: CallState.SPEAKING });
  };

  // 检查是否已连接
  const isConnected = callState !== CallState.IDLE && callState !== CallState.ERROR;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">语音识别 &amp; 音频强度测试</h1>
      
      <div className="flex flex-col gap-8">
        {/* 状态显示 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">当前状态:</span>
            <span className="px-2 py-1 rounded-md bg-muted text-sm">
              {callState}
            </span>
          </div>
          
          {/* 控制按钮 */}
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              onClick={handleStartCall}
              disabled={isConnected || loading}
              className="px-3 py-2 rounded-md bg-primary text-white disabled:opacity-50"
            >
              {loading ? '连接中...' : '开始通话'}
            </button>
            
            <button
              onClick={handleEndCall}
              disabled={!isConnected || loading}
              className="px-3 py-2 rounded-md bg-destructive text-white disabled:opacity-50"
            >
              结束通话
            </button>
            
            <button
              onClick={handleStartListening}
              disabled={!isConnected || callState === CallState.LISTENING}
              className="px-3 py-2 rounded-md bg-green-600 text-white disabled:opacity-50"
            >
              测试监听状态
            </button>
            
            <button
              onClick={handleStartSpeaking}
              disabled={!isConnected || callState === CallState.SPEAKING}
              className="px-3 py-2 rounded-md bg-amber-600 text-white disabled:opacity-50"
            >
              测试AI说话状态
            </button>
          </div>
        </div>
        
        {/* 语音识别容器 */}
        <div className="border rounded-lg p-4">
          <SpeechRecognitionContainer className="h-[500px]" />
        </div>
        
        {/* 使用说明 */}
        <div className="text-sm text-muted-foreground">
          <h3 className="font-medium mb-2">使用说明:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>点击"开始通话"初始化语音服务</li>
            <li>说话时会显示实时音频强度和语音转文字</li>
            <li>可以使用测试按钮切换不同状态</li>
            <li>完成后点击"结束通话"断开连接</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
