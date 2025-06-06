import "styles/tailwind.css"
import { Toaster } from "sonner"
import { Nav } from "../components/Nav"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <Nav />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
