import { Badge } from "../ui/badge"
import packageJson from "../../package.json"
import Link from "next/link"
import { logger } from "../../lib/logger"

export function Nav() {
  logger.info("Navigation component rendered")
  
  return (
    <nav className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/75">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Open Voice Chat
              </span>
            </h1>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-xs">
            v{packageJson.version}
          </Badge>
        </div>
      </div>
    </nav>
  )
}
