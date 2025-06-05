import { CallState } from "./VoiceChat"

interface CallStatusProps {
  state: CallState
  duration: string
  isMuted: boolean
}

export function CallStatus({ state, duration, isMuted }: CallStatusProps) {
  const getStatusText = () => {
    switch (state) {
      case "idle":
        return "等待通话"
      case "connecting":
        return "正在连接..."
      case "connected":
        return "通话中"
      case "speaking":
        return "对方正在说话"
      case "listening":
        return "正在聆听"
      default:
        return ""
    }
  }

  const getStatusColor = () => {
    switch (state) {
      case "idle":
        return "text-gray-500 dark:text-gray-400"
      case "connecting":
        return "text-blue-500 dark:text-blue-400"
      case "connected":
        return "text-green-500 dark:text-green-400"
      case "speaking":
        return "text-blue-600 dark:text-blue-400"
      case "listening":
        return "text-purple-600 dark:text-purple-400"
      default:
        return "text-gray-500"
    }
  }

  return (
    <div className="text-center space-y-2">
      <div className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </div>
      
      {state !== "idle" && (
        <div className="text-lg font-mono text-gray-700 dark:text-gray-300">
          {duration}
        </div>
      )}
      
      {isMuted && state !== "idle" && (
        <div className="text-xs text-red-500 dark:text-red-400 flex items-center justify-center space-x-1">
          <span>🔇</span>
          <span>麦克风已静音</span>
        </div>
      )}
      
      {state === "connecting" && (
        <div className="flex justify-center space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      )}
    </div>
  )
}
