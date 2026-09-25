import { ArrowDown, ArrowUp } from "lucide-react"
import { CountryFlag } from "@/components/CountryFlag"
import { type Node, useNodeLatency } from "@/lib/api"
import { bytes, CYCLES, getNodeExpiryDays, FOREVER, money, osName, pair, percent, rate, uptime } from "@/lib/format"
import { cn } from "@/lib/utils"

export function NodeCompactCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const m = node.metrics
  const latency = useNodeLatency(node.id, node.online)
  const avgMs = latency?.avgMs ?? null
  const cpuPct = m ? m.cpu : null
  const memPct = m ? percent(m.mem_used, m.mem_total) : null
  const diskPct = m ? percent(m.disk_used, m.disk_total) : null
  const monthUsed = node.month_used !== undefined ? node.month_used : (node.month_rx ?? 0) + (node.month_tx ?? 0)
  const trafficPct = node.traffic_limit > 0 ? percent(monthUsed, node.traffic_limit) : null
  const trafficFoot = node.traffic_limit > 0 ? pair(monthUsed, node.traffic_limit) : `${bytes(monthUsed)} / ${FOREVER}`
  const days = getNodeExpiryDays(node)
  const isFree = node.billing_cycle === "free" || (node.price !== undefined && node.price === 0)
  const cycleText =
    node.billing_cycle === "monthly"
      ? "月"
      : node.billing_cycle === "quarterly"
      ? "季"
      : node.billing_cycle === "yearly"
      ? "年"
      : node.billing_cycle === "semiannual"
      ? "半年"
      : CYCLES[node.billing_cycle] ?? "月"
  const priceStr = node.price && node.price > 0 ? `${money(node.price, node.currency)}/${cycleText}` : null
  const expiryStr = days === null ? null : days < 0 ? "已过期" : days === 0 ? "今日到期" : `${days}天`

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="glass-card group relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-border/50 p-3 sm:p-4 shadow-2xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm cursor-pointer select-none"
    >
      {/* 1. Header: Flag, Name, OS/Arch, Status, Price & Expiry */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pt-0.5">
          <CountryFlag country={node.country} />
          <div className="min-w-0">
            <span className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors block">
              {node.name}
            </span>
            <div className="text-[10px] text-muted-foreground truncate font-normal">
              {node.os ? osName(node.os) : "等待上报"}
              {node.arch ? ` · ${node.arch}` : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0 text-right">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium select-none",
              node.online ? "bg-ok/12 text-ok" : "bg-destructive/12 text-destructive"
            )}
          >
            <span className={cn("size-1.5 rounded-full", node.online ? "bg-ok animate-pulse-dot" : "bg-destructive")} />
            {node.online ? (m ? uptime(m.uptime) : "在线") : "离线"}
          </span>

          {(isFree || priceStr || expiryStr) && (
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground tnum font-normal select-none">
              {isFree ? (
                <span className="font-normal text-muted-foreground/80">免费</span>
              ) : priceStr ? (
                <span className="font-medium text-foreground/80">{priceStr}</span>
              ) : null}
              {(isFree || priceStr) && expiryStr && (
                <span className="text-border/60">·</span>
              )}
              {expiryStr && (
                <span
                  className={cn(
                    days !== null && days < 0 ? "text-destructive font-semibold" : days !== null && days <= 7 ? "text-warn font-semibold" : ""
                  )}
                >
                  {expiryStr}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. 4 Compact Progress Bars */}
      <div className="my-1.5 sm:my-2.5 grid grid-cols-4 gap-1.5 sm:gap-2">
        {/* CPU */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9px] font-medium text-muted-foreground">
            <span>CPU</span>
            <span className="tnum font-semibold text-foreground">{cpuPct !== null ? `${cpuPct.toFixed(0)}%` : "—"}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (cpuPct ?? 0) >= 90 ? "bg-destructive" : (cpuPct ?? 0) >= 75 ? "bg-warn" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, cpuPct ?? 0))}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9px] font-medium text-muted-foreground">
            <span>内存</span>
            <span className="tnum font-semibold text-foreground">{memPct !== null ? `${memPct.toFixed(0)}%` : "—"}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (memPct ?? 0) >= 90 ? "bg-destructive" : (memPct ?? 0) >= 75 ? "bg-warn" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, memPct ?? 0))}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9px] font-medium text-muted-foreground">
            <span>存储</span>
            <span className="tnum font-semibold text-foreground">{diskPct !== null ? `${diskPct.toFixed(0)}%` : "—"}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (diskPct ?? 0) >= 90 ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, diskPct ?? 0))}%` }}
            />
          </div>
        </div>

        {/* Traffic */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[9px] font-medium text-muted-foreground">
            <span>流量</span>
            <span className="tnum font-semibold text-foreground">{trafficPct !== null ? `${trafficPct.toFixed(0)}%` : FOREVER}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (trafficPct ?? 0) >= 90 ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, trafficPct ?? 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Footer: Rate, Latency & Traffic */}
      <div className="pt-1.5 sm:pt-2 border-t border-border/25 space-y-1 text-[10px] text-muted-foreground select-none">
        {/* Top: Live Speed & Latency (plus mobile monthly traffic) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold tnum">
            <span className="text-ok flex items-center">
              <ArrowDown className="size-2.5" />
              {m ? rate(m.net_rx) : "0 B/s"}
            </span>
            <span className="text-sky-400 flex items-center">
              <ArrowUp className="size-2.5" />
              {m ? rate(m.net_tx) : "0 B/s"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {node.online && avgMs !== null && (
              <span className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground font-medium">平延:</span>
                <span
                  className={cn(
                    "tnum font-semibold",
                    avgMs <= 0 ? "text-destructive" : avgMs <= 50 ? "text-ok" : avgMs <= 120 ? "text-sky-500" : "text-amber-500"
                  )}
                >
                  {avgMs <= 0 ? "超时" : `${avgMs}ms`}
                </span>
              </span>
            )}
            <div className="tnum font-normal truncate text-right sm:hidden">
              <span className="font-semibold text-foreground">{trafficFoot}</span>
            </div>
          </div>
        </div>

        {/* Bottom (Desktop / Tablet only): Month Usage & Cumulative Traffic */}
        <div className="hidden sm:flex items-center justify-between text-muted-foreground/85 text-[10px] pt-0.5">
          <div className="tnum font-normal truncate pr-1">
            <span>月用量: </span>
            <span className="font-semibold text-foreground">{trafficFoot}</span>
          </div>
          <div className="tnum font-normal text-muted-foreground/80 shrink-0">
            <span>↓ {bytes(node.total_rx)}</span>
            <span className="ml-1">↑ {bytes(node.total_tx)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
