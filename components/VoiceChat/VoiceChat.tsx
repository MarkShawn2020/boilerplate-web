"use client"

import { useEffect, useCallback } from "react"
import { toast } from "sonner"

// 组件导入
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { CallStatus } from "./CallStatus"
import { PersonaSelector } from "./PersonaSelector"
import { WaveAnimation } from "./WaveAnimation"

// 服务和状态管理导入
import { useVoiceChatStore, CallState, Persona, initializeVoiceChat } from "../../store/voice-chat-store"
import { logger } from "../../services/logger"

// 模拟数据 - 实际项目中应从API获取
const DEFAULT_PERSONAS = [
  {
    id: "persona1",
    name: "智能助理",
    description: "专业、简洁的通用AI助手",
    avatar: "/avatars/INTELLIGENT_ASSISTANT.png",
    voiceId: "voice_female_1",
  },
  {
    id: "persona2",
    name: "知识导师",
    description: "专注学术问题的博学导师",
    avatar: "/avatars/TEACHING_ASSISTANT.png",
    voiceId: "voice_male_1",
  },
  {
    id: "persona3",
    name: "创意伙伴",
    description: "帮助激发创意的艺术伙伴",
    avatar: "/avatars/VIRTUAL_GIRL_FRIEND.png",
    voiceId: "voice_female_2",
  },
  {
    id: "persona4",
    name: "心理顾问",
    description: "温暖体贴的情感顾问",
    avatar: "/avatars/CHILDREN_ENCYCLOPEDIA.png",
    voiceId: "voice_male_2",
  },
]

export interface VoiceChatProps {
  personas?: Persona[]
}


export function VoiceChat({ personas = DEFAULT_PERSONAS }: VoiceChatProps) {
  // 使用全局状态
  const {
    callState,
    selectedPersona,
    audioStatus,
    error,
    messages,
    isMuted,
    initializeServices,
    setSelectedPersona,
    connectCall,
    disconnectCall,
    toggleMute,
    sendMessage,
  } = useVoiceChatStore()
  
  // 格式化通话时间
  const formatDuration = (seconds) => {
    // 格式化逻辑
  }
  
  // 组件挂载时初始化服务
  useEffect(() => {
    initializeServices().catch(error => {
      logger.error("初始化服务失败", error)
      toast.error("初始化语音服务失败")
    })
    
    // 初始化人设
    if (personas.length > 0 && !selectedPersona) {
      setSelectedPersona(personas[0])
    }
    
    return () => {
      // 清理逻辑
    }
  }, [])
  
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
  const handlePersonaSelect = (persona) => {
    if (callState !== "idle") {
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
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6 rounded-xl bg-white p-6 shadow-lg">
      {/* 人设选择器 */}
      {callState === "idle" && (
        <PersonaSelector personas={personas} selectedPersona={selectedPersona} onSelect={handlePersonaSelect} />
      )}

      {/* 头像 */}
      <Avatar
        persona={selectedPersona}
        size={callState === "idle" ? "large" : "medium"}
        isActive={isSpeaking || callState === "speaking" || callState === "listening"}
      />

      {/* 名称和状态 */}
      <CallStatus
        state={callState}
        duration={formatDuration(duration)}
        isMuted={isMuted}
      />

      {/* 语音波形动画 */}
      {(callState === "speaking" || callState === "listening") && <WaveAnimation isActive={isSpeaking} />}

      {/* 错误提示 */}
      {errorMessage && <div className="text-sm text-red-500">{errorMessage}</div>}

      {/* 通话控制按钮 */}
      <CallControls
        callState={callState}
        isMuted={isMuted}
        onStartCall={handleCallStart}
        onEndCall={handleCallEnd}
        onToggleMute={handleToggleMute}
      />

      {/* 开发模式下显示消息内容和测试按钮 */}
      {process.env.NODE_ENV === "development" && callState === "connected" && (
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
          {aiMessage && (
            <p>
              <span className="font-bold">{selectedPersona.name}:</span> {aiMessage}
            </p>
          )}
        </div>
      )}

      {callState === "idle" && (
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
          点击通话按钮开始与 {selectedPersona.name} 对话
        </p>
      )}

      {callState === "connected" && (
        <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">按住麦克风按钮说话，松开发送语音</p>
      )}
    </div>
  )
}
