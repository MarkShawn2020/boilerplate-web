import { CallState } from "./VoiceChat"

interface CallControlsProps {
  callState: CallState
  isMuted: boolean
  onStartCall: () => void
  onEndCall: () => void
  onToggleMute: () => void
}

export function CallControls({ 
  callState, 
  isMuted, 
  onStartCall, 
  onEndCall, 
  onToggleMute 
}: CallControlsProps) {
  
  if (callState === "idle") {
    return (
      <div className="flex justify-center">
        <button
          onClick={onStartCall}
          className="w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full 
                   shadow-lg hover:shadow-xl transition-all duration-200 
                   flex items-center justify-center text-2xl hover:scale-105
                   focus:outline-none focus:ring-4 focus:ring-green-500/30"
        >
          📞
        </button>
      </div>
    )
  }

  if (callState === "connecting") {
    return (
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-blue-500 text-white rounded-full 
                       shadow-lg flex items-center justify-center text-2xl
                       animate-pulse">
          ⏳
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center space-x-6">
      {/* 静音按钮 */}
      <button
        onClick={onToggleMute}
        className={`w-12 h-12 rounded-full shadow-lg transition-all duration-200 
                   flex items-center justify-center text-xl hover:scale-105
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
        className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full 
                 shadow-lg hover:shadow-xl transition-all duration-200 
                 flex items-center justify-center text-2xl hover:scale-105
                 focus:outline-none focus:ring-4 focus:ring-red-500/30"
      >
        📵
      </button>

      {/* 扬声器按钮 */}
      <button
        className="w-12 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full 
                 shadow-lg transition-all duration-200 
                 flex items-center justify-center text-xl hover:scale-105
                 focus:outline-none focus:ring-4 focus:ring-gray-500/30
                 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
      >
        🔊
      </button>
    </div>
  )
}
