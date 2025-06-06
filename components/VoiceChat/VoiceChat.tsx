"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

// 服务和状态管理导入
import { logger } from "../../lib/logger"
import { CallState, Persona, useVoiceChatStore } from "../../store/voice-chat-store"

// 组件导入
import { Avatar } from "./Avatar"
import { CallControls } from "./CallControls"
import { MicrophoneControl } from "./MicrophoneControl"
import { PersonaSelector } from "./PersonaSelector"
import { VolumeVisualizer } from "./VolumeVisualizer"
import { WaveAnimation } from "./WaveAnimation"

export function VoiceChat() {
  // 本地状态管理
  const [duration, setDuration] = useState(0)
  const [showMicSettings, setShowMicSettings] = useState(false)

  // 从 Zustand store 获取状态
  const {
    // 基础状态
    callState,
    selectedPersona,
    personas,
    error, // 业务数据
    messages,
    realtimeSubtitles,
    isAgentActive, // 初始化方法
    initializeServices,

    // 音频相关
    isMuted,
    connectCall,
    disconnectCall,
    setSelectedPersona,
  } = useVoiceChatStore()

  // 每秒更新通话时间
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (callState === CallState.CONNECTED || callState === CallState.SPEAKING || callState === CallState.LISTENING) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } else {
      setDuration(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [callState])

  // 格式化通话时间
  const formatDuration = (seconds: number): string => {
    if (!seconds) return "00:00"
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // 单独处理人设初始化
  useEffect(() => {
    if (personas.length > 0 && !selectedPersona && personas[0]) {
      setSelectedPersona(personas[0])
    }
  }, [personas, selectedPersona, setSelectedPersona])

  // 组件挂载时初始化服务 - 只在挂载时执行一次
  useEffect(() => {
    logger.info("开始初始化语音服务")

    void initializeServices()

    return () => {
      logger.info("组件卸载，清理语音服务资源")
      // 组件卸载时的清理逻辑
    }
  }, []) // 依赖数组为空，只在挂载时运行一次

  // 页面刷新前清理语音连接
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // 如果当前有活跃的语音对话，先关闭
      if (callState !== CallState.IDLE) {
        logger.info("页面刷新前，关闭活跃的语音对话")
        try {
          await disconnectCall()
        } catch (error) {
          logger.error("页面刷新前关闭语音对话失败", error)
        }
      }
    }

    // 添加页面刷新前的事件监听
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [callState, disconnectCall])

  // 处理开始通话
  const handleCallStart = async () => {
    try {
      await connectCall()
      logger.info("通话开始成功")
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
  const handleToggleMute = async () => {}

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

  return (
    <div className="xs:max-w-md relative flex h-full w-full flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 右上角控制面板 */}
      <div className="absolute top-4 right-4 rounded-lg border border-gray-200 bg-white/90 shadow-sm backdrop-blur-sm">
        {/* 智能体状态 */}
        {isAgentActive && (
          <div className="flex items-center gap-2 border-b border-gray-200 p-2">
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${isAgentActive ? "animate-pulse bg-green-500" : "bg-gray-400"}`} />
              <span className="text-xs text-gray-700">{isAgentActive ? "智能体已启动" : "等待启动"}</span>
            </div>
            {duration > 0 && <div className="text-xs text-gray-500">{formatDuration(duration)}</div>}
          </div>
        )}

        {/* 麦克风设置控制 */}
        {isAgentActive && (
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={() => setShowMicSettings(!showMicSettings)}
              className="w-full text-center text-xs text-gray-600 transition-colors hover:text-gray-800"
            >
              {showMicSettings ? "隐藏" : "显示"} 麦克风设置
            </button>
          </div>
        )}

        {/* 麦克风控制面板 */}
        {showMicSettings && (
          <div className="flex-shrink-0 p-4">
            <MicrophoneControl
              className="mx-auto max-w-2xl"
              onError={(error) => {
                logger.error("Microphone error", error)
                toast.error(`Microphone error: ${error.message}`)
              }}
            />
          </div>
        )}
      </div>

      {/* 人设选择器 */}
      {callState === CallState.IDLE && (
        <div className="flex-shrink-0 p-4">
          <PersonaSelector personas={personas} selectedPersona={selectedPersona} onSelect={handlePersonaSelect} />
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="mt-auto flex flex-1 flex-col items-center justify-center space-y-8 p-6">
        {/* AI 角色头像和信息 */}
        {selectedPersona && (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <Avatar persona={selectedPersona} size="large" isActive={callState === CallState.SPEAKING} />

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">{selectedPersona.name}</h2>
              <p className="max-w-md text-gray-600">{selectedPersona.description}</p>
            </div>
          </div>
        )}

        {/*/!* 语音波形动画 *!/*/}
        {/*{isAgentActive && (*/}
        {/*  <div className="space-y-4">*/}
        {/*    <WaveAnimation isActive={callState === CallState.SPEAKING} />*/}
        {/*    <VolumeVisualizer level={audioLevel} />*/}
        {/*  </div>*/}
        {/*)}*/}

        {/* 对话消息显示区域 */}

        {callState !== CallState.IDLE && (
          <div className="max-h-64 w-full max-w-2xl overflow-y-auto rounded-xl bg-white/80 p-4 backdrop-blur-sm">
            <h4 className="mb-3 flex items-center text-sm font-medium text-gray-700">
              <span className="ml-2 rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">实时语音识别</span>
            </h4>

            <div className="space-y-3">
              {/* 显示完整的聊天记录 */}
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                      message.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="mt-1 text-xs opacity-70">{new Date(message.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}

              {/* 显示正在进行的实时语音识别 */}
              {Array.from(realtimeSubtitles.values()).map((subtitle) => {
                const isUser = !subtitle.userId.toLowerCase().startsWith("bot")
                return (
                  <div key={subtitle.userId} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`relative max-w-xs rounded-lg px-4 py-2 lg:max-w-md ${
                        isUser ? "bg-blue-400/70 text-white" : "bg-gray-300/70 text-gray-800"
                      }`}
                    >
                      <p className="text-sm">{subtitle.text}</p>
                      <div className="mt-1 text-xs opacity-70">正在识别...</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
          <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}
