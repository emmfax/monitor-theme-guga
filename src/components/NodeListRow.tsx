import { ArrowDown, ArrowUp, Activity } from "lucide-react"
import { CountryFlag } from "@/components/CountryFlag"
import { type Node, useNodeLatency } from "@/lib/api"
import { CYCLES, FOREVER, bytes, getNodeExpiryDays, money, osName, pair, percent, rate } from "@/lib/format"
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
  const expiryShort = days === null ? "永久有效" : days < 0 ? "已过期" : days === 0 ? "今日到期" : `${days}天`

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="glass-card group relative flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 lg:gap-3 rounded-xl sm:rounded-2xl lg:rounded-3xl border border-border/50 px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3.5 shadow-2xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm cursor-pointer select-none"
    >
      {/* ===== MOBILE VIEW (<lg): Ultra-compact 2-line dense layout ===== */}
      <div className="flex flex-col gap-1.5 w-full lg:hidden">
        {/* Line 1: Flag + Name + (OS) on left | Status + Latency + Price/Expiry on right */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <CountryFlag country={node.country} />
            <span className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {node.name}
            </span>
            <div className="text-[10px] text-muted-foreground truncate font-normal hidden sm:inline">
              {node.os ? osName(node.os) : ""}
              {node.arch ? ` · ${node.arch}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-right">
            {node.online && avgMs !== null && (
              <span
                className={cn(
                  "tnum text-[9px] font-medium px-1.5 py-0.2 rounded-full",
                  avgMs <= 0
                    ? "text-destructive bg-destructive/10"
                    : avgMs <= 50
                    ? "text-ok bg-ok/10"
                    : avgMs <= 120
                    ? "text-sky-500 bg-sky-500/10"
                    : "text-amber-500 bg-amber-500/10"
                )}
              >
                {avgMs <= 0 ? "超时" : `${avgMs}ms`}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-medium",
                node.online ? "bg-ok/12 text-ok" : "bg-destructive/12 text-destructive"
              )}
            >
              <span className={cn("size-1.5 rounded-full", node.online ? "bg-ok animate-pulse-dot" : "bg-destructive")} />
              {node.online ? "在线" : "离线"}
            </span>

            {(isFree || priceStr || expiryShort) && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground tnum font-normal pl-1 border-l border-border/30">
                {isFree ? (
                  <span className="font-normal text-muted-foreground/80">免费</span>
                ) : priceStr ? (
                  <span className="font-medium text-foreground/80">{priceStr}</span>
                ) : null}
                {(isFree || priceStr) && expiryShort && <span className="text-border/60">·</span>}
                {expiryShort && (
                  <span
                    className={cn(
                      days !== null && days < 0
                        ? "text-destructive font-semibold"
                        : days !== null && days <= 7
                        ? "text-warn font-semibold"
                        : ""
                    )}
                  >
                    {expiryShort}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Line 2: Live Speed on left | 4 Compact Resource Indicators on right */}
        <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] select-none">
          {/* Live Speed */}
          <div className="flex items-center gap-1.5 font-semibold tnum shrink-0">
            <span className="text-ok flex items-center gap-0.5">
              <ArrowDown className="size-2.5" />
              <span className="text-[10px]">{m ? rate(m.net_rx) : "0 B/s"}</span>
            </span>
            <span className="text-sky-400 flex items-center gap-0.5">
              <ArrowUp className="size-2.5" />
              <span className="text-[10px]">{m ? rate(m.net_tx) : "0 B/s"}</span>
            </span>
          </div>

          {/* 4 Compact Resource Indicators */}
          <div className="flex items-center gap-2 sm:gap-2.5 text-[9px] tnum shrink-0">
            {/* CPU */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">CPU</span>
              <span
                className={cn(
                  "font-semibold",
                  (cpuPct ?? 0) >= 90 ? "text-destructive" : (cpuPct ?? 0) >= 75 ? "text-warn" : "text-foreground"
                )}
              >
                {cpuPct !== null ? `${cpuPct.toFixed(0)}%` : "—"}
              </span>
              <div className="w-5 sm:w-7 h-1 rounded-full bg-muted/60 overflow-hidden">
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
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">内存</span>
              <span
                className={cn(
                  "font-semibold",
                  (memPct ?? 0) >= 90 ? "text-destructive" : (memPct ?? 0) >= 75 ? "text-warn" : "text-foreground"
                )}
              >
                {memPct !== null ? `${memPct.toFixed(0)}%` : "—"}
              </span>
              <div className="w-5 sm:w-7 h-1 rounded-full bg-muted/60 overflow-hidden">
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
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">存储</span>
              <span className={cn("font-semibold", (diskPct ?? 0) >= 90 ? "text-destructive" : "text-foreground")}>
                {diskPct !== null ? `${diskPct.toFixed(0)}%` : "—"}
              </span>
            </div>

            {/* Traffic */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">流量</span>
              <span className="font-semibold text-foreground">
                {trafficPct !== null ? `${trafficPct.toFixed(0)}%` : FOREVER}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP VIEW (>=lg): High-efficiency aligned table columns ===== */}
      {/* 1. Name & OS (Desktop) */}
      <div className="hidden lg:flex items-center justify-start gap-3 w-[220px] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
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
            <div className="text-[11px] text-foreground/75 truncate font-normal">
              {node.os ? osName(node.os) : "等待上报"}
              {node.arch ? ` · ${node.arch}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Resources: CPU, RAM, Disk, Traffic (Desktop) */}
      <div className="hidden lg:grid grid-cols-4 gap-3 w-[360px] shrink-0">
        {/* CPU */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-foreground/75">
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
          <div className="flex items-center justify-between text-[10px] font-medium text-foreground/75">
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
          <div className="flex items-center justify-between text-[10px] font-medium text-foreground/75">
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
          <div className="flex items-center justify-between text-[10px] font-medium text-foreground/75">
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

      {/* 3. Live Speed (Desktop) */}
      <div className="hidden lg:flex items-center gap-2 w-[190px] shrink-0 text-xs tnum">
        <Activity className="size-3.5 text-ok shrink-0" />
        <div className="flex items-center gap-1.5 font-semibold">
          <span className="text-ok flex items-center gap-0.5 w-[76px] shrink-0">
            <ArrowDown className="size-2.5 shrink-0" />
            <span className="truncate">{m ? rate(m.net_rx) : "0 B/s"}</span>
          </span>
          <span className="text-sky-400 flex items-center gap-0.5 w-[76px] shrink-0">
            <ArrowUp className="size-2.5 shrink-0" />
            <span className="truncate">{m ? rate(m.net_tx) : "0 B/s"}</span>
          </span>
        </div>
      </div>

      {/* 3.5 Average Latency (Desktop) */}
      <div className="hidden lg:flex items-center gap-1.5 w-[90px] shrink-0 text-xs select-none">
        <span className="text-[11px] text-foreground/70 font-medium shrink-0">平延:</span>
        {node.online && avgMs !== null ? (
          <span
            className={cn(
              "tnum text-[11px] font-semibold w-[48px] truncate",
              avgMs <= 0 ? "text-destructive" : avgMs <= 50 ? "text-ok" : avgMs <= 120 ? "text-sky-500" : "text-amber-500"
            )}
          >
            {avgMs <= 0 ? "超时" : `${avgMs}ms`}
          </span>
        ) : (
          <span className="text-[11px] text-foreground/50 w-[48px]">—</span>
        )}
      </div>

      {/* 4. Traffic Usage & Expiry (Desktop) */}
      <div className="hidden lg:flex items-center justify-end gap-3.5 sm:gap-4 w-[230px] shrink-0 text-xs">
        <div className="text-[11px] text-foreground/80 tnum font-normal flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <span className="text-foreground/70 font-medium">月用量:</span>
            <span className="font-bold text-foreground">{trafficUsage}</span>
          </div>
          <div className="text-[10px] text-foreground/75 font-medium flex items-center gap-1">
            <span>总计:</span>
            <span>↓ {bytes(node.total_rx)}</span>
            <span>↑ {bytes(node.total_tx)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right flex flex-col items-end gap-1">
          {days === null ? (
            <span className="text-[10px] font-semibold text-foreground/80">永久有效 ∞</span>
          ) : days < 0 ? (
            <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              已过期 {-days}天
            </span>
          ) : days === 0 ? (
            <span className="text-[10px] font-medium text-warn bg-warn/15 px-2 py-0.5 rounded-full">今日到期</span>
          ) : (
            <span className="text-[10px] font-semibold text-foreground/85">{days} 天后到期</span>
          )}
          {isFree ? (
            <span className="text-[10px] font-medium text-foreground/70 tnum">续费: 免费</span>
          ) : node.price && node.price > 0 ? (
            <span className="text-[10px] font-medium text-foreground/70 tnum">
              续费: {money(node.price, node.currency)} / {CYCLES[node.billing_cycle] ?? node.billing_cycle ?? "月付"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
