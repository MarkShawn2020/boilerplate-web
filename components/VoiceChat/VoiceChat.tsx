"use client"

import { useEffect, useMemo, useState } from "react"

// 组件导入 - 使用相对路径
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { CallStatus } from "./CallStatus"
import { PersonaSelector } from "./PersonaSelector"
import { WaveAnimation } from "./WaveAnimation"

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

export interface Persona {
  id: string
  name: string
  description: string
  avatar: string
  voiceId?: string
}

export interface VoiceChatProps {
  personas?: Persona[]
}

// 将服务状态映射为简化的UI状态
export type CallState = "idle" | "connecting" | "connected" | "speaking" | "listening"

export function VoiceChat({ personas = DEFAULT_PERSONAS }: VoiceChatProps) {
  // 确保始终有一个有效的默认人设
  const defaultPersona = useMemo(() => {
    // 确保DEFAULT_PERSONAS至少有一个元素，这是必须的
    const defaultPersonaItem = DEFAULT_PERSONAS[0];
    
    // 如果personas有效且非空，使用第一个人设，否则使用默认人设
    return (Array.isArray(personas) && personas.length > 0) 
      ? personas[0] 
      : defaultPersonaItem;
  }, [personas]) as Persona; // 使用类型断言确保返回类型是Persona
  
  const [selectedPersona, setSelectedPersona] = useState<Persona>(defaultPersona)
  const [callState, setCallState] = useState<CallState>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userMessage, setUserMessage] = useState<string>("")
  const [aiMessage, setAiMessage] = useState<string>("")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // 初始化时显示的日志信息
  useEffect(() => {
    console.info("VoiceChat组件初始化")

    // 模拟服务初始化和事件回调
    // 注意：在实际项目中，这里将使用RTCService和DoubaoService
    // 目前先以模拟形式展示UI效果
  }, [])

  // 通话计时器
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    // 如果正在通话中，启动计时器
    if (callState === "connected" || callState === "speaking" || callState === "listening") {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    }

    // 如果通话结束，重置计时器
    if (callState === "idle") {
      setDuration(0)
    }

    // 清理函数
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [callState])

  // 处理通话控制
  const handleCallStart = async () => {
    // 模拟连接过程
    try {
      console.info("开始通话")
      setCallState("connecting")

      // 模拟连接延迟
      setTimeout(() => {
        setCallState("connected")
      }, 1500)
    } catch (error) {
      console.error("开始通话出错", error)
      setErrorMessage((error as Error).message)
    }
  }

  const handleCallEnd = async () => {
    try {
      console.info("结束通话")
      // 重置状态
      setCallState("idle")
      setDuration(0)
      setUserMessage("")
      setAiMessage("")
    } catch (error) {
      console.error("结束通话出错", error)
    }
  }

  const handleToggleMute = () => {
    const newMutedState = !isMuted
    setIsMuted(newMutedState)
    console.info(`${newMutedState ? "开启" : "关闭"}静音`)
  }

  // 人设选择处理
  const handlePersonaSelect = (persona: Persona) => {
    // 如果已经在通话中，需要先断开
    if (callState !== "idle") {
      handleCallEnd().then(() => {
        setSelectedPersona(persona)
      })
    } else {
      setSelectedPersona(persona)
    }
  }

  // 模拟收到用户消息
  const simulateUserMessage = () => {
    if (callState === "connected" || callState === "listening") {
      setUserMessage("这是用户的语音输入示例")
      setCallState("listening")

      // 模拟AI响应
      setTimeout(() => {
        simulateAIResponse()
      }, 1500)
    }
  }

  // 模拟AI回复
  const simulateAIResponse = () => {
    setAiMessage("你好，我是AI助手，很高兴为你提供帮助!")
    setCallState("speaking")
    setIsSpeaking(true)

    // 模拟语音结束
    setTimeout(() => {
      setIsSpeaking(false)
      setCallState("connected")
    }, 3000)
  }

  // 格式化通话时间
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
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
