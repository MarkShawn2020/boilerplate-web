import type { Metadata } from "next"
import { VoiceChat } from "../components/VoiceChat"

export const metadata: Metadata = {
  title: "Open Voice Chat - 智能语音对话",
  description: "基于豆包AI的实时语音对话系统，支持自定义人设",
  twitter: {
    card: "summary_large_image",
  },
  openGraph: {
    url: "https://open-voice-chat.vercel.app/",
    images: [
      {
        width: 1200,
        height: 630,
        url: "/og-image.png",
      },
    ],
  },
}

export default function HomePage() {
  return (
    <main className="h-screen relative overflow-hidden">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      
      {/* 装饰性元素 */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-blue-200/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-200/30 rounded-full blur-3xl" />
      
      <div className="h-full relative z-10 container mx-auto px-4 py-12 flex flex-col">
        {/* 标题区域 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Open Voice Chat
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            基于豆包AI的智能语音对话系统，让AI更懂你的心
          </p>
        </div>

        {/* 语音聊天组件 */}
        <div className="flex justify-center flex-1">
          <VoiceChat />
        </div>

        {/* 底部说明 */}
        <div className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400 shrink-0">
          <p>支持实时语音对话 • 多种AI人设 • 自然语音交互</p>
        </div>
      </div>
    </main>
  )
}
