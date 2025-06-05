"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

// 组件导入
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { CallStatus } from "./CallStatus"
import { MicrophoneControl } from "./MicrophoneControl"
import { PersonaSelector } from "./PersonaSelector"
import { VolumeVisualizer } from "./VolumeVisualizer"
import { WaveAnimation } from "./WaveAnimation"

// Hook 导入
import { useMicrophone } from "../../hooks/useMicrophone"

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
  } = useVoiceChatStore()

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
    
    if (callState === CallState.CONNECTED || 
        callState === CallState.SPEAKING || 
        callState === CallState.LISTENING) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
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
      logger.info("初始化默认人设")
      setSelectedPersona(personas[0])
    }
  }, [personas, selectedPersona, setSelectedPersona])

  // 组件挂载时初始化服务 - 只在挂载时执行一次
  useEffect(() => {
    logger.info("开始初始化语音服务")
    // initializeServices().catch(err => {
    //   logger.error("初始化服务失败", err)
    //   toast.error("初始化语音服务失败")
    //   setErrorMessage("初始化服务失败")
    // })
    
    return () => {
      logger.info("组件卸载，清理语音服务资源")
      // 组件卸载时的清理逻辑
    }
  }, []) // 依赖数组为空，只在挂载时运行一次
  
  // 处理开始通话
  const handleCallStart = async () => {
    try {
      await connectCall()
    } catch (error) {
      logger.error("Failed to start call", error)
      toast.error("通话连接失败")
    }
  }

  // 处理结束通话
  const handleCallEnd = async () => {
    try {
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
  })

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col w-full xs:max-w-md">


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
              isActive={callState === CallState.SPEAKING}
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

        {/* 对话消息显示区域 */}
        {messages.length > 0 && (
          <div className="w-full max-w-2xl bg-white/80 backdrop-blur-sm rounded-xl p-4 max-h-64 overflow-y-auto">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部控制面板 */}
      <div className="flex-shrink-0 p-4 space-y-4">

                {/* 主要通话控制 */}
                <CallControls
          callState={callState}
          isMuted={isMuted}
          onStartCall={handleCallStart}
          onEndCall={handleCallEnd}
          onToggleMute={handleToggleMute}
        />


        {/* 麦克风设置按钮 */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowMicSettings(!showMicSettings)}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {showMicSettings ? 'Hide' : 'Show'} Microphone Settings
          </button>
        </div>

        {/* 麦克风控制面板 */}
        {showMicSettings && (
          <MicrophoneControl
            className="mx-auto max-w-2xl"
            onRecordingStart={() => {
              logger.info('Microphone recording started');
              // 这里可以集成到 RTC 服务中
            }}
            onRecordingStop={() => {
              logger.info('Microphone recording stopped');
            }}
            onError={(error) => {
              logger.error('Microphone error', error);
              toast.error(`Microphone error: ${error.message}`);
            }}
          />
        )}


      </div>
    </div>
  )
}
