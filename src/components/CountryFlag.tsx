import * as flags from "country-flag-icons/string/3x2"
import { cn } from "@/lib/utils"

export function CountryFlag({
  country,
  className,
}: {
  country?: string | null
  className?: string
}) {
  if (!country) return null
  const code = country.toUpperCase()
  const svg = (flags as Record<string, string>)[code]

  if (!svg) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-[4px] bg-muted px-1.5 text-[9px] font-semibold uppercase border border-border/40 shrink-0",
          className
        )}
      >
        {code}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] shadow-2xs leading-none border border-black/10 dark:border-white/10 aspect-[3/2] w-5 h-3.5 [&>svg]:size-full [&>svg]:object-cover select-none",
        className
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
