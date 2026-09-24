import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  icon?: ReactNode
  label: ReactNode
  pct: number | null
  foot: ReactNode
  empty?: ReactNode
}

/**
 * Tactile capsule slider meter (Volume/Brightness style):
 * high-radius full pill track with smooth dynamic fill and embedded glanceable label.
 * Clean, artifact-free progress bar with zero border clipping glitches.
 */
export function Meter({ icon, label, pct, foot, empty = "—" }: Props) {
  const filled = pct === null ? 0 : Math.min(100, Math.max(0, pct))
  const isHigh = filled >= 85
  const isCritical = filled >= 92

  return (
    <div className="min-w-0 flex flex-col gap-1.5">
      {/* Tactile Pill Track (Pixel Volume/Brightness slider capsule) */}
      <div className="relative h-8 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-white/[0.08] flex items-center select-none shadow-2xs border border-border/40 dark:border-white/10">
        {/* Animated fill: smooth continuous progress fill, clipped by parent overflow-hidden rounded-full */}
        {pct !== null && filled > 0 && (
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out",
              isCritical
                ? "bg-destructive/35 dark:bg-destructive/40"
                : isHigh
                ? "bg-warn/35 dark:bg-warn/40"
                : "bg-primary/20 dark:bg-white/20"
            )}
            style={{ width: `${filled}%` }}
          />
        )}

        {/* Embedded Label with Icon (Left) */}
        <div className="absolute left-3 flex items-center gap-1.5 z-10 pointer-events-none min-w-0 pr-12">
          {icon}
          <span className="truncate text-xs font-medium text-foreground dark:text-white tracking-tight">
            {label}
          </span>
        </div>

        {/* Embedded Percentage Badge (Right) */}
        <div className="absolute right-3 flex items-center z-10 pointer-events-none shrink-0">
          <span
            className={cn(
              "tnum text-xs font-semibold tracking-tight",
              isCritical
                ? "text-destructive font-bold"
                : isHigh
                ? "text-warn font-bold"
                : "text-foreground dark:text-white"
            )}
          >
            {pct === null ? empty : `${filled < 10 ? filled.toFixed(1) : filled.toFixed(0)}%`}
          </span>
        </div>
      </div>

      {/* Subtext info below track */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span className="tnum truncate font-normal">{foot}</span>
      </div>
    </div>
  )
}
