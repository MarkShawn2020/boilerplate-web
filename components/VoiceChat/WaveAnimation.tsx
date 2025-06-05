interface WaveAnimationProps {
  isActive: boolean
}

export function WaveAnimation({ isActive }: WaveAnimationProps) {
  if (!isActive) return null

  return (
    <div className="flex items-center justify-center space-x-1">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-blue-400 to-purple-500 rounded-full animate-pulse"
          style={{
            height: `${Math.random() * 20 + 10}px`,
            animationDelay: `${i * 100}ms`,
            animationDuration: '1s'
          }}
        />
      ))}
    </div>
  )
}
