"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

// 组件导入
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { CallStatus } from "./CallStatus"
import { PersonaSelector } from "./PersonaSelector"
import { WaveAnimation } from "./WaveAnimation"

// 服务和状态管理导入
import { logger } from "../../services/logger"
import { useVoiceChatStore, CallState, Persona } from "../../store/voice-chat-store"


export function VoiceChat() {
  // 本地状态管理
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [userMessage, setUserMessage] = useState<string>("");
  const [aiMessage, setAiMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // 使用全局状态
  const {
    callState,
    isMuted,
    selectedPersona,
    personas,
    messages,
    error,
    initializeServices,
    setSelectedPersona,
    connectCall,
    disconnectCall,
    toggleMute,
    sendMessage,
  } = useVoiceChatStore()

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
  
  // 模拟语音状态变化
  useEffect(() => {
    if (callState === CallState.SPEAKING) {
      setIsSpeaking(true);
    } else {
      setIsSpeaking(false);
    }
  }, [callState]);

  
  // 格式化通话时间
  const formatDuration = (seconds: number): string => {
    if (!seconds) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  // 组件挂载时初始化服务 - 只在挂载时执行一次
  useEffect(() => {
    logger.info("开始初始化语音服务")
    initializeServices().catch(err => {
      logger.error("初始化服务失败", err)
      toast.error("初始化语音服务失败")
      setErrorMessage("初始化服务失败")
    })
    
    return () => {
      logger.info("组件卸载，清理语音服务资源")
      // 组件卸载时的清理逻辑
    }
  }, []) // 依赖数组为空，只在挂载时运行一次
  
  // 单独处理人设初始化
  useEffect(() => {
    if (personas.length > 0 && !selectedPersona && personas[0]) {
      logger.info("初始化默认人设")
      setSelectedPersona(personas[0])
    }
  }, [personas, selectedPersona, setSelectedPersona])
  
  // 处理错误状态变化
  useEffect(() => {
    if (error) {
      setErrorMessage(`错误: ${error.message}`)
    }
  }, [error])
  
  // 处理通话控制
  const handleCallStart = async () => {
    try {
      await connectCall()
    } catch (error) {
      toast.error("开始通话失败")
    }
  }
  
  const handleCallEnd = async () => {
    try {
      await disconnectCall()
    } catch (error) {
      toast.error("结束通话失败")
    }
  }
  
  const handleToggleMute = async () => {
    try {
      await toggleMute()
    } catch (error) {
      toast.error("麦克风控制失败")
    }
  }
  
  // 人设选择处理
  const handlePersonaSelect = (persona: Persona) => {
    if (callState !== CallState.IDLE) {
      handleCallEnd().then(() => {
        setSelectedPersona(persona)
      })
    } else {
      setSelectedPersona(persona)
    }
  }
  
  // 模拟发送消息
  const simulateUserMessage = () => {
    // 可以在开发环境下用于测试
    const testMessage = "这是一条测试消息";
    setUserMessage(testMessage);
    sendMessage(testMessage).then(() => {
      // 显示最新一条AI消息
      if (messages.length > 0) {
        const lastAiMessage = messages.findLast(m => m.role === 'assistant');
        if (lastAiMessage) {
          setAiMessage(lastAiMessage.content);
        }
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6 rounded-xl bg-white p-6 shadow-lg">
      {/* 人设选择器 */}
      {callState === CallState.IDLE && (
        <PersonaSelector 
          personas={personas} 
          selectedPersona={selectedPersona ?? null}  
          onSelect={handlePersonaSelect} 
        />
      )}

      {/* 头像 */}
      {selectedPersona && (
        <Avatar
          persona={selectedPersona}
          size={callState === CallState.IDLE ? "large" : "medium"}
          isActive={isSpeaking || callState === CallState.SPEAKING || callState === CallState.LISTENING}
        />
      )}

      {/* 名称和状态 */}
      <CallStatus
        state={callState}
        duration={formatDuration(duration)}
        isMuted={isMuted}
      />

      {/* 语音波形动画 */}
      {(callState === CallState.SPEAKING || callState === CallState.LISTENING) && (
        <WaveAnimation isActive={isSpeaking} />
      )}

      {/* 错误提示 */}
      {errorMessage && (
        <div className="text-sm text-red-500">{errorMessage}</div>
      )}

      {/* 通话控制按钮 */}
      <CallControls
        callState={callState}
        isMuted={isMuted}
        onStartCall={handleCallStart}
        onEndCall={handleCallEnd}
        onToggleMute={handleToggleMute}
      />

      {/* 开发模式下显示消息内容和测试按钮 */}
      {process.env.NODE_ENV === "development" && callState === CallState.CONNECTED && (
        <div className="mt-4 w-full rounded bg-gray-50 p-2 text-xs">
          <button
            onClick={simulateUserMessage}
            className="mb-2 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          >
            模拟用户语音
          </button>
          {userMessage && (
            <p className="mb-1">
              <span className="font-bold">你:</span> {userMessage}
            </p>
          )}
          {aiMessage && selectedPersona && (
            <p>
              <span className="font-bold">{selectedPersona.name}:</span> {aiMessage}
            </p>
          )}
        </div>
      )}

      {callState === CallState.IDLE && selectedPersona && (
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          点击通话按钮开始与 {selectedPersona.name} 对话
        </p>
      )}

      {callState === CallState.CONNECTED && (
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">按住麦克风按钮说话，松开发送语音</p>
      )}
    </div>
  )
}
