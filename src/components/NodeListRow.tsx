import { ArrowDown, ArrowUp, Activity } from "lucide-react"
import { CountryFlag } from "@/components/CountryFlag"
import { type Node, useNodeLatency } from "@/lib/api"
import { FOREVER, bytes, daysUntil, osName, pair, percent, rate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function NodeListRow({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const m = node.metrics
  const cpuPct = m ? m.cpu : null
  const memPct = m ? percent(m.mem_used, m.mem_total) : null
  const diskPct = m ? percent(m.disk_used, m.disk_total) : null
  const monthUsed = node.month_used !== undefined ? node.month_used : (node.month_rx ?? 0) + (node.month_tx ?? 0)
  const trafficPct = node.traffic_limit > 0 ? percent(monthUsed, node.traffic_limit) : null
  const trafficUsage = node.traffic_limit > 0 ? pair(monthUsed, node.traffic_limit) : `${bytes(monthUsed)} / ${FOREVER}`
  const latency = useNodeLatency(node.id, node.online)
  const avgMs = latency?.avgMs ?? null
  const days = node.expires_in !== undefined && node.expires_in !== null ? node.expires_in : daysUntil(node.expires_at)

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="glass-card group relative flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-3xl border border-border/50 px-5 py-3.5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm cursor-pointer select-none"
    >
      {/* 1. Name & OS */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <CountryFlag country={node.country} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {node.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] font-medium shrink-0",
                node.online ? "bg-ok/12 text-ok" : "bg-destructive/12 text-destructive"
              )}
            >
              <span className={cn("size-1.5 rounded-full", node.online ? "bg-ok animate-pulse-dot" : "bg-destructive")} />
              {node.online ? "在线" : "离线"}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate font-normal">
            {node.os ? osName(node.os) : "等待上报"}
            {node.arch ? ` · ${node.arch}` : ""}
          </div>
        </div>
      </div>

      {/* 2. Resources: CPU, RAM, Disk, Traffic */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 min-w-[320px] sm:min-w-[360px]">
        {/* CPU */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>流量</span>
            <span className="tnum font-semibold text-foreground">
              {trafficPct !== null ? `${trafficPct.toFixed(0)}%` : FOREVER}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                (trafficPct ?? 0) >= 90 ? "bg-destructive" : (trafficPct ?? 0) >= 75 ? "bg-warn" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, trafficPct ?? 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Live Speed */}
      <div className="flex items-center gap-2 min-w-[150px] text-xs tnum">
        <Activity className="size-3.5 text-ok shrink-0" />
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="text-ok flex items-center">
            <ArrowDown className="size-2.5" />
            {m ? rate(m.net_rx) : "0 B/s"}
          </span>
          <span className="text-sky-400 flex items-center">
            <ArrowUp className="size-2.5" />
            {m ? rate(m.net_tx) : "0 B/s"}
          </span>
        </div>
      </div>

      {/* 3.5 Average Latency */}
      <div className="flex items-center gap-1.5 min-w-[80px] text-xs select-none">
        <span className="text-[11px] text-muted-foreground font-medium shrink-0">平延:</span>
        {node.online && avgMs !== null ? (
          <span className={cn(
            "tnum text-[11px] font-semibold",
            avgMs <= 0 ? "text-destructive" : avgMs <= 50 ? "text-ok" : avgMs <= 120 ? "text-sky-500" : "text-amber-500"
          )}>
            {avgMs <= 0 ? "超时" : `${avgMs}ms`}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </div>

      {/* 4. Traffic Usage & Expiry */}
      <div className="flex items-center justify-between lg:justify-end gap-3.5 sm:gap-4 min-w-[200px] text-xs">
        <div className="text-[11px] text-muted-foreground tnum font-normal flex flex-col items-start lg:items-end gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">月用量:</span>
            <span className="font-semibold text-foreground">{trafficUsage}</span>
          </div>
          <div className="text-[10px] text-muted-foreground/75 flex items-center gap-1">
            <span>总计:</span>
            <span>↓ {bytes(node.total_rx)}</span>
            <span>↑ {bytes(node.total_tx)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {days === null ? (
            <span className="text-[10px] font-medium text-muted-foreground">永久有效 ∞</span>
          ) : days < 0 ? (
            <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              已过期 {-days}天
            </span>
          ) : days === 0 ? (
            <span className="text-[10px] font-medium text-warn bg-warn/15 px-2 py-0.5 rounded-full">今日到期</span>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground">{days} 天后到期</span>
          )}
        </div>
      </div>
    </div>
  )
}
