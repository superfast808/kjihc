import { useState } from "react"
import { Bell, BellOff, X, Loader2 } from "lucide-react"
import { type PushState } from "@/hooks/useStaffWebPush"
import { cn } from "@/lib/utils"

interface NotificationPromptProps {
  state: PushState
  onEnable: () => void
  onDisable?: () => void
  /** Storage key used to track session-dismissal — must be unique per portal */
  dismissKey: string
  /** Colour theme — 'dark' for the navy staff sidebar, 'light' for the parent portal */
  theme?: "dark" | "light"
}

const DISMISSED_VAL = "dismissed"

export default function NotificationPrompt({
  state,
  onEnable,
  onDisable,
  dismissKey,
  theme = "light",
}: NotificationPromptProps) {
  const [sessionDismissed, setSessionDismissed] = useState(
    () => sessionStorage.getItem(dismissKey) === DISMISSED_VAL,
  )

  const dismiss = () => {
    sessionStorage.setItem(dismissKey, DISMISSED_VAL)
    setSessionDismissed(true)
  }

  // Don't render when: already granted, dismissed this session, or loading on mount
  if (sessionDismissed || state === "unsupported") return null
  if (state === "granted") return null

  const isDark = theme === "dark"

  if (state === "denied") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl px-4 py-3 text-sm border",
          isDark
            ? "bg-white/5 border-white/10 text-white/70"
            : "bg-amber-50 border-amber-200 text-amber-800",
        )}
      >
        <BellOff size={16} className="flex-shrink-0 mt-0.5 opacity-70" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-snug">Notifications are blocked</p>
          <p className="text-xs mt-0.5 opacity-80">
            To receive updates, allow notifications for this site in your browser settings.
          </p>
        </div>
        <button onClick={dismiss} className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      </div>
    )
  }

  // state === "default" or "loading"
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm border",
        isDark
          ? "bg-[#f6a800]/10 border-[#f6a800]/30 text-white"
          : "bg-blue-50 border-blue-200 text-blue-900",
      )}
    >
      <Bell size={16} className={cn("flex-shrink-0", isDark ? "text-[#f6a800]" : "text-blue-500")} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug">Stay in the loop</p>
        <p className={cn("text-xs mt-0.5", isDark ? "text-white/60" : "text-blue-700/80")}>
          Enable notifications for messages and upcoming events.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
          <button
          onClick={onEnable}
          disabled={state === "loading"}
          className={cn(
            "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
            isDark
              ? "bg-[#f6a800] hover:bg-[#f6a800]/80 text-[#001f3d]"
              : "bg-blue-600 hover:bg-blue-700 text-white",
          )}
        >
          {state === "loading" && <Loader2 size={11} className="animate-spin" />}
          Enable
        </button>
        <button onClick={dismiss} className="opacity-40 hover:opacity-80 transition-opacity">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
