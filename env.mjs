import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    ANALYZE: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  },
  client: {
    NEXT_PUBLIC_RTC_APP_ID: z.string().optional(),
    NEXT_PUBLIC_RTC_APP_KEY: z.string().optional(),
    NEXT_PUBLIC_RTC_ROOM_ID: z.string().optional(),
    NEXT_PUBLIC_RTC_USER_ID: z.string().optional(),
    NEXT_PUBLIC_RTC_TOKEN: z.string().optional(),
    NEXT_PUBLIC_RTC_TASK_ID: z.string().optional(),
  },
  runtimeEnv: {
    ANALYZE: process.env.ANALYZE,
    NEXT_PUBLIC_RTC_APP_ID: process.env.NEXT_PUBLIC_RTC_APP_ID,
    NEXT_PUBLIC_RTC_APP_KEY: process.env.NEXT_PUBLIC_RTC_APP_KEY,
    NEXT_PUBLIC_RTC_ROOM_ID: process.env.NEXT_PUBLIC_RTC_ROOM_ID,
    NEXT_PUBLIC_RTC_USER_ID: process.env.NEXT_PUBLIC_RTC_USER_ID,
    NEXT_PUBLIC_RTC_TOKEN: process.env.NEXT_PUBLIC_RTC_TOKEN,
    NEXT_PUBLIC_RTC_TASK_ID: process.env.NEXT_PUBLIC_RTC_TASK_ID,
  },
})
