import { CallState } from "../../store/voice-chat-store"

interface CallControlsProps {
  callState: CallState
  isMuted: boolean
  onStartCall: () => void
  onEndCall: () => void
  onToggleMute: () => void
  compact?: boolean
}

export function CallControls({ 
  callState, 
  isMuted, 
  onStartCall, 
  onEndCall, 
  onToggleMute,
  compact = false
}: CallControlsProps) {
  
  // 紧凑模式的样式
  const buttonSizes = compact 
    ? { main: 'w-8 h-8', secondary: 'w-6 h-6', text: 'text-sm' }
    : { main: 'w-16 h-16', secondary: 'w-12 h-12', text: 'text-2xl' }
  
  const spacing = compact ? 'space-x-2' : 'space-x-6'
  
  if (callState === "idle") {
    return (
      <div className="flex justify-center">
        <button
          onClick={onStartCall}
          className={`${buttonSizes.main} bg-green-500 hover:bg-green-600 text-white rounded-full 
                     shadow-lg hover:shadow-xl transition-all duration-200 
                     flex items-center justify-center ${buttonSizes.text} hover:scale-105
                     focus:outline-none focus:ring-4 focus:ring-green-500/30 p-12  `}
        >
          📞
        </button>
      </div>
    )
  }

  if (callState === "connecting") {
    return (
      <div className="flex justify-center">
        <div className={`${buttonSizes.main} bg-blue-500 text-white rounded-full 
                       shadow-lg flex items-center justify-center ${buttonSizes.text}
                       animate-pulse`}>
          ⏳
        </div>
      </div>
    )
  }

  return (
    <div className={`flex justify-center ${spacing}`}>
      {/* 静音按钮 */}
      <button
        onClick={onToggleMute}
        className={`${buttonSizes.secondary} rounded-full shadow-lg transition-all duration-200 
                   flex items-center justify-center text-lg hover:scale-105
                   focus:outline-none focus:ring-4 focus:ring-opacity-30
                   ${isMuted 
                     ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500' 
                     : 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white'
                   }`}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      {/* 挂断按钮 */}
      <button
        onClick={onEndCall}
        className={`${buttonSizes.main} bg-red-500 hover:bg-red-600 text-white rounded-full 
                   shadow-lg hover:shadow-xl transition-all duration-200 
                   flex items-center justify-center ${buttonSizes.text} hover:scale-105
                   focus:outline-none focus:ring-4 focus:ring-red-500/30`}
      >
        📵
      </button>

      {!compact && (
        /* 扬声器按钮 - 仅在非紧凑模式显示 */
        <button
          className={`${buttonSizes.secondary} bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full 
                     shadow-lg transition-all duration-200 
                     flex items-center justify-center text-xl hover:scale-105
                     focus:outline-none focus:ring-4 focus:ring-gray-500/30
                     dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white`}
        >
          🔊
        </button>
      )}
    </div>
  )
}
