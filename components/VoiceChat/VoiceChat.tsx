"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

// 组件导入
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { MicrophoneControl } from "./MicrophoneControl"
import { PersonaSelector } from "./PersonaSelector"
import { VolumeVisualizer } from "./VolumeVisualizer"
import { WaveAnimation } from "./WaveAnimation"

// Hook 导入
import { useMicrophone } from "../../hooks/useMicrophone"
import { useVoiceChat } from "../../hooks/useVoiceChat"

// 服务和状态管理导入
import { logger } from "../../services/logger"
import { useVoiceChatStore, CallState, Persona } from "../../store/voice-chat-store"


export function VoiceChat() {
  // 本地状态管理
  const [duration, setDuration] = useState(0);
  const [showMicSettings, setShowMicSettings] = useState(false);

  // 从 Zustand store 获取状态
  const {
    callState,
    isMuted,
    selectedPersona,
    personas,
    error,
    connectCall,
    disconnectCall,
    toggleMute,
    setSelectedPersona,
    messages,
    realtimeSubtitles,
    taskId,
    isAgentActive,
  } = useVoiceChatStore()

  // 使用 useVoiceChat hook
  const {
    listeners,
    audioLevel,
    isConnected,
    startRecording,
    stopRecording,
    switchDevice,
  } = useVoiceChat();

  // 麦克风 Hook
  const {
    volumeLevel,
    isRecording: micIsRecording,
  } = useMicrophone();

  // 语音状态管理
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 每秒更新通话时间
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === CallState.CONNECTED || callState === CallState.SPEAKING || callState === CallState.LISTENING) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);
  
  // 格式化通话时间
  const formatDuration = (seconds: number): string => {
    if (!seconds) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // 模拟语音状态变化
  useEffect(() => {
    if (callState === CallState.SPEAKING) {
      setIsSpeaking(true);
    } else {
      setIsSpeaking(false);
    }
  }, [callState]);

  // 单独处理人设初始化
  useEffect(() => {
    if (personas.length > 0 && !selectedPersona && personas[0]) {
      setSelectedPersona(personas[0])
    }
  }, [personas, selectedPersona, setSelectedPersona])

  // 组件挂载时初始化服务 - 只在挂载时执行一次
  useEffect(() => {
    logger.info("开始初始化语音服务")
    const initServices = async () => {
      try {
        const { initializeServices } = useVoiceChatStore.getState();
        await initializeServices();
        logger.info("语音服务初始化成功");
      } catch (err) {
        logger.error("初始化服务失败", err)
        toast.error("初始化语音服务失败")
      }
    };
    
    initServices();
    
    return () => {
      logger.info("组件卸载，清理语音服务资源")
      // 组件卸载时的清理逻辑
    }
  }, []) // 依赖数组为空，只在挂载时运行一次
  
  // 处理开始通话
  const handleCallStart = async () => {
    try {
      await connectCall()
      await startRecording()
      logger.info("通话开始成功")
    } catch (error) {
      logger.error("Failed to start call", error)
      toast.error("通话连接失败")
    }
  }

  // 处理结束通话
  const handleCallEnd = async () => {
    try {
      await stopRecording()
      await disconnectCall()
      setDuration(0)
    } catch (error) {
      logger.error("Failed to end call", error)
    }
  }

  // 处理静音切换
  const handleToggleMute = async () => {
    try {
      await toggleMute()
    } catch (error) {
      logger.error("Failed to toggle mute", error)
    }
  }

  // 处理人设选择
  const handlePersonaSelect = (persona: Persona) => {
    if (callState !== CallState.IDLE) {
      handleCallEnd().then(() => {
        setSelectedPersona(persona)
      })
    } else {
      setSelectedPersona(persona)
    }
    logger.info(`Selected persona: ${persona.name}`)
  }

  logger.info("当前状态:", {
    callState,
    isMuted,
    error,
    duration,
    messages,
    audioLevel,
    isConnected,
  })

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col w-full xs:max-w-md relative">

      {/* 右上角控制面板 */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm">
        {/* 智能体状态 */}
        {isConnected && (
          <div className="p-2 border-b border-gray-200 flex items-center gap-2 items-center">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isAgentActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-700">
                {isAgentActive ? '智能体已启动' : '等待启动'}
              </span>
            </div>
            {duration > 0 && (
              <div className="text-xs text-gray-500">
                {formatDuration(duration)}
              </div>
            )}
          </div>
        )}
        


        {/* 麦克风设置控制 */}
        {isConnected && (
          <div className="p-2 border-t border-gray-200">
            <button
              onClick={() => setShowMicSettings(!showMicSettings)}
              className="text-xs text-gray-600 hover:text-gray-800 transition-colors w-full text-center"
            >
              {showMicSettings ? '隐藏' : '显示'} 麦克风设置
            </button>
          </div>
        )}

              {/* 麦克风控制面板 */}
      {showMicSettings && (
        <div className="flex-shrink-0 p-4">
          <MicrophoneControl
            className="mx-auto max-w-2xl"
            onError={(error) => {
              logger.error('Microphone error', error);
              toast.error(`Microphone error: ${error.message}`);
            }}
          />
        </div>
      )}
      </div>

      {/* 人设选择器 */}
      {callState === CallState.IDLE && (
        <div className="flex-shrink-0 p-4">
          <PersonaSelector
            personas={personas}
            selectedPersona={selectedPersona}
            onSelect={handlePersonaSelect}
          />
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* AI 角色头像和信息 */}
        {selectedPersona && (
          <div className="text-center space-y-4 flex flex-col justify-center items-center">
            <Avatar
              persona={selectedPersona}
              size="large"
              isActive={callState === CallState.SPEAKING || isSpeaking}
            />
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">
                {selectedPersona.name}
              </h2>
              <p className="text-gray-600 max-w-md">
                {selectedPersona.description}
              </p>
            </div>
          </div>
        )}

        {/* 语音波形动画 */}
        {isConnected && (
          <div className="space-y-4">
            <WaveAnimation isActive={isSpeaking || callState === CallState.SPEAKING} />
            <VolumeVisualizer level={audioLevel} />
          </div>
        )}

        {/* 对话消息显示区域 */}

          <div className="w-full max-w-2xl bg-white/80 backdrop-blur-sm rounded-xl p-4 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">

                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  实时语音识别
                </span>
            </h4>
            
            <div className="space-y-3">
              {/* 显示完整的聊天记录 */}
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* 显示正在进行的实时语音识别 */}
              {Array.from(realtimeSubtitles.values()).map((subtitle) => {
                const isUser = !subtitle.userId.toLowerCase().startsWith('bot');
                return (
                  <div
                    key={subtitle.userId}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                        isUser
                          ? 'bg-blue-400/70 text-white'
                          : 'bg-gray-300/70 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{subtitle.text}</p>
                      {!subtitle.isComplete && (
                        <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse opacity-50" />
                      )}
                      <div className="text-xs opacity-70 mt-1">
                        正在识别...
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


                {/* 主要通话控制 */}
                <div className="p-2">
          <CallControls
            callState={callState}
            isMuted={isMuted}
            onStartCall={handleCallStart}
            onEndCall={handleCallEnd}
            onToggleMute={handleToggleMute}
            compact={false}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        )}
      </div>



      {/* 提示文字 */}
      {callState === CallState.IDLE && selectedPersona && (
        <p className="text-center text-sm text-gray-500">
          点击通话按钮开始与 {selectedPersona.name} 对话
        </p>
      )}


    </div>
  )
}
