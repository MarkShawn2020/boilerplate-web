import Image from 'next/image';
import { Persona } from "../../store/voice-chat-store"

interface AvatarProps {
  persona: Persona
  size?: "small" | "medium" | "large"
  isActive?: boolean
}

export function Avatar({ persona, size = "medium", isActive = false }: AvatarProps) {
  const sizePx = {
    small: 48, // w-12 h-12
    medium: 64, // w-16 h-16
    large: 96, // w-24 h-24
  };
  
  const sizeClasses = {
    small: "w-12 h-12 text-2xl",
    medium: "w-16 h-16 text-3xl", 
    large: "w-24 h-24 text-5xl"
  };

  return (
    <div className={`
      ${sizeClasses[size]}
      relative flex items-center justify-center
      rounded-full bg-gradient-to-br from-blue-100 to-purple-100
      dark:from-blue-900/20 dark:to-purple-900/20
      border-4 transition-all duration-300 overflow-hidden
      ${isActive 
        ? 'border-green-400 shadow-lg shadow-green-400/30 scale-105' 
        : 'border-gray-200 dark:border-gray-600'
      }
    `}>
      {persona.avatar && persona.avatar.startsWith('/') ? (
        <Image 
          src={persona.avatar}
          alt={`${persona.name} avatar`}
          width={sizePx[size] ?? 128}
          height={sizePx[size] ?? 128}
          className="object-cover w-full h-full"
          priority={size === "large"}
        />
      ) : (
        <span className="select-none">
          {persona.avatar || persona.name.charAt(0)}
        </span>
      )}
      
      {/* 激活状态指示器 */}
      {isActive && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 animate-pulse" />
      )}
    </div>
  )
}
