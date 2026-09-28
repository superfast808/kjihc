import { useQuery } from "@tanstack/react-query"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  memberId: number
  playerPhoto?: string | null
  name: string
  className?: string
  size?: "sm" | "md" | "lg"
}

const SIZE: Record<string, string> = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-20 h-20 text-xl",
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""

/**
 * Renders the player's photo (fetched as a short-lived signed URL) or falls
 * back to a navy circle with initials when no photo is available.
 * Used in the staff roster tiles.
 */
export default function PlayerAvatar({ memberId, playerPhoto, name, className, size = "md" }: Props) {
  const { data: photoUrl } = useQuery({
    queryKey: ["player-photo-url", memberId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/members/${memberId}/photo-url`)
      if (!r.ok) return null
      const json = await r.json() as { url: string }
      return json.url
    },
    enabled: !!playerPhoto,
    staleTime: 50 * 60 * 1000, // 50 min — URL valid for 1 h
    gcTime:   60 * 60 * 1000,
    retry: false,
  })

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("")

  const sz = SIZE[size] ?? SIZE.md

  if (playerPhoto && photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn("object-cover rounded-full flex-shrink-0 border border-white/10", sz, className)}
      />
    )
  }

  return (
    <div className={cn(
      "rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-bold text-primary select-none",
      sz, className,
    )}>
      {initials || <User size={14} />}
    </div>
  )
}
