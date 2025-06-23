import { Button } from '@/components/Button/Button'
import Image from 'next/image'
import Link from 'next/link'

export default function ComatePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <section className="mb-12 text-center">
        <div className="flex justify-center mb-6">
          <Image 
            src="/assets/blazity-logo-light.svg" 
            alt="文心快码Logo"
            width={200}
            height={60}
            className="dark:hidden"
          />
          <Image 
            src="/assets/blazity-logo-dark.svg" 
            alt="文心快码Logo"
            width={200}
            height={60}
            className="hidden dark:block"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4">文心快码开发者体验</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          百度推出的AI编程助手，深度集成开发环境，提供从需求分析到代码生成的全流程智能支持
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="https://comate.baidu.com/zh" target="_blank">
              访问官网
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="#features">
              查看功能
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8 mb-12">
        <div>
          <h2 className="text-2xl font-semibold mb-4">产品亮点</h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="mr-2">🚀</span>
              <span>深度集成IDE的AI编程助手</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">💡</span>
              <span>支持代码生成、调试和优化</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">⚡</span>
              <span>全流程开发支持，从需求到代码</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h2 className="text-2xl font-semibold mb-4">使用体验</h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="mr-2">👍</span>
              <span>代码生成准确率高，大幅减少重复工作</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">👏</span>
              <span>上下文理解能力强，能处理复杂需求</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">🎯</span>
              <span>响应速度快，开发体验流畅</span>
            </li>
          </ul>
        </div>
      </section>

      <section id="features" className="mb-12 scroll-mt-20">
        <h2 className="text-2xl font-semibold mb-6 text-center">核心功能</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-medium mb-3">代码生成</h3>
            <p className="text-gray-600">
              根据自然语言描述自动生成高质量代码，支持多种编程语言
            </p>
          </div>
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-medium mb-3">问题调试</h3>
            <p className="text-gray-600">
              智能分析代码问题，提供修复建议和优化方案
            </p>
          </div>
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-medium mb-3">文档生成</h3>
            <p className="text-gray-600">
              自动生成API文档和代码注释，保持文档与代码同步
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">参与开发者活动</h2>
        <p className="mb-4">
          现在加入文心快码开发者活动，体验AI编程的未来！
        </p>
        <Button asChild variant="secondary">
          <Link href="https://comate.baidu.com/zh" target="_blank">
            立即参与
          </Link>
        </Button>
      </section>
    </main>
  )
}