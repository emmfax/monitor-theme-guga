import { useState, type ReactNode } from "react"
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Gauge,
  Server,
  HardDrive,
  Zap,
  Clock,
  RefreshCw,
} from "lucide-react"

import { speedHistory, type Node } from "@/lib/api"
import { bytes, pair, percent, rate, uptime } from "@/lib/format"
import { cn } from "@/lib/utils"

type PeakMode = "cpu" | "mem" | "net" | "uptime"

const PEAK_MODES: { key: PeakMode; label: string; icon: typeof Activity }[] = [
  { key: "uptime", label: "在线时长最长", icon: Clock },
  { key: "cpu", label: "CPU峰值", icon: Activity },
  { key: "mem", label: "内存峰值", icon: HardDrive },
  { key: "net", label: "吞吐峰值", icon: Zap },
]

function QuickSettingsTile({
  icon: Icon,
  label,
  badge,
  children,
  onClick,
}: {
  icon: typeof Server
  label: string
  badge?: ReactNode
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-card group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/50 p-4 sm:p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-sm",
        onClick && "cursor-pointer active:scale-[0.99]"
      )}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
            <Icon className="size-4" />
          </div>
          <span className="text-xs font-medium text-muted-foreground tracking-tight truncate">{label}</span>
        </div>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function Flow({ down, up }: { down: string; up: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 select-none">
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 truncate">
          <ArrowDown className="size-3 text-ok shrink-0" /> 今日下行
        </span>
        <span className="tnum text-base sm:text-lg font-semibold text-foreground tracking-tight mt-0.5 truncate">
          {down}
        </span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 truncate">
          <ArrowUp className="size-3 text-sky-400 shrink-0" /> 今日上行
        </span>
        <span className="tnum text-base sm:text-lg font-semibold text-foreground tracking-tight mt-0.5 truncate">
          {up}
        </span>
      </div>
    </div>
  )
}

function ExpressiveWave({ series }: { series: { rx: number; tx: number }[] }) {
  if (series.length < 2) {
    return <div className="h-8 w-full rounded-lg bg-muted/20 animate-pulse" />
  }

  const rxValues = series.map((s) => s.rx)
  const txValues = series.map((s) => s.tx)
  const max = Math.max(...rxValues, ...txValues, 1024 * 1024)
  const len = series.length - 1

  const buildPath = (values: number[]) => {
    return values
      .map((v, i) => {
        const x = (i / len) * 100
        const y = 28 - (v / max) * 24
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(" ")
  }

  const rxPath = buildPath(rxValues)
  const txPath = buildPath(txValues)

  return (
    <div className="relative h-8 w-full overflow-hidden">
      <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="size-full" aria-hidden>
        <defs>
          <linearGradient id="rx-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ok)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-ok)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={`${rxPath} L 100 28 L 0 28 Z`} fill="url(#rx-fill)" />
        <path d={rxPath} fill="none" stroke="var(--color-ok)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={txPath} fill="none" stroke="#38bdf8" strokeWidth="1.25" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export function Summary({
  nodes,
  group,
  collapsed = false,
  siteName,
}: {
  nodes: Node[]
  group: string | null
  collapsed?: boolean
  siteName?: string
}) {
  const [peakMode, setPeakMode] = useState<PeakMode>("uptime")

  const online = nodes.filter((n) => n.online)
  const offlineCount = nodes.length - online.length
  const sum = (pick: (n: Node) => number) => nodes.reduce((total, n) => total + pick(n), 0)

  const cyclePeakMode = () => {
    const idx = PEAK_MODES.findIndex((m) => m.key === peakMode)
    setPeakMode(PEAK_MODES[(idx + 1) % PEAK_MODES.length].key)
  }

  const history = speedHistory.get(group) ?? []
  const now = history.at(-1) ?? { rx: 0, tx: 0 }

  if (collapsed) {
    return (
      <div className="glass-card flex items-center justify-between rounded-2xl sm:rounded-full border border-border/50 px-3.5 sm:px-4.5 py-2 text-xs shadow-xs select-none">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none py-0.5 min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-foreground shrink-0">
            <span className="size-2 rounded-full bg-ok animate-pulse-dot" />
            {online.length}/{nodes.length} 在线
          </span>
          <span className="text-border/60 shrink-0">/</span>
          <span className="text-muted-foreground truncate">
            今日: <span className="tnum font-medium text-foreground">↓{bytes(sum((n) => n.day_rx))} · ↑{bytes(sum((n) => n.day_tx))}</span>
          </span>
          <span className="text-border/60 hidden md:inline shrink-0">/</span>
          <span className="text-muted-foreground hidden md:inline shrink-0">
            速率: <span className="tnum font-medium text-foreground">{rate(now.rx + now.tx)}</span>
          </span>
          <span className="text-border/60 hidden md:inline shrink-0">/</span>
          <span className="text-muted-foreground hidden md:inline shrink-0">
            累计: <span className="tnum font-medium text-foreground">{bytes(sum((n) => n.total_rx + n.total_tx))}</span>
          </span>
        </div>

        {/* User Site Name on the far right of the collapsed summary bar */}
        {siteName && (
          <div className="flex items-center pl-3 border-l border-border/40 shrink-0 ml-2">
            <span className="text-xs font-semibold text-foreground tracking-tight">
              {siteName}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Calculations for dynamic peak modes (computed only when expanded and active)
  const topCpuNode =
    peakMode === "cpu"
      ? online.reduce<Node | null>(
          (top, n) => (n.metrics && (!top || n.metrics.cpu > top.metrics!.cpu) ? n : top),
          null
        )
      : null

  const topMemNode =
    peakMode === "mem"
      ? online.reduce<Node | null>((top, n) => {
          if (!n.metrics) return top
          const pct = percent(n.metrics.mem_used, n.metrics.mem_total)
          const topPct = top?.metrics ? percent(top.metrics.mem_used, top.metrics.mem_total) : 0
          return pct > topPct ? n : top
        }, null)
      : null

  const topNetNode =
    peakMode === "net"
      ? online.reduce<Node | null>((top, n) => {
          if (!n.metrics) return top
          const speed = n.metrics.net_rx + n.metrics.net_tx
          const topSpeed = top?.metrics ? top.metrics.net_rx + top.metrics.net_tx : 0
          return speed > topSpeed ? n : top
        }, null)
      : null

  const topUptimeNode =
    peakMode === "uptime"
      ? online.reduce<Node | null>(
          (top, n) => (n.metrics && (!top || n.metrics.uptime > top.metrics!.uptime) ? n : top),
          null
        )
      : null

  return (
    <div className="space-y-2.5">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* 1. Fleet Cluster Tile */}
        <QuickSettingsTile
          icon={Server}
          label="节点集群"
        badge={
          offlineCount === 0 ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-ok/12 px-2 py-0.5 text-[11px] font-semibold text-ok border border-ok/20 shadow-2xs">
              <span className="size-1.5 rounded-full bg-ok animate-pulse-dot" />
              全员正常
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg bg-destructive/12 px-2 py-0.5 text-[11px] font-semibold text-destructive border border-destructive/20">
              {offlineCount} 台待恢复
            </span>
          )
        }
      >
        <div className="tnum text-2xl font-semibold tracking-tight text-foreground">
          {online.length}
          <span className="text-sm font-normal text-muted-foreground ml-1.5">/ {nodes.length} 在线</span>
        </div>
        {group && (
          <div className="mt-1 text-xs text-muted-foreground truncate font-normal">
            分组: {group}
          </div>
        )}
      </QuickSettingsTile>

      {/* 2. Dynamic Switchable Peak Tile */}
      <QuickSettingsTile
        icon={
          peakMode === "cpu"
            ? Activity
            : peakMode === "mem"
            ? HardDrive
            : peakMode === "net"
            ? Zap
            : Clock
        }
        label={PEAK_MODES.find((m) => m.key === peakMode)!.label}
        onClick={cyclePeakMode}
        badge={
          <button
            onClick={(e) => {
              e.stopPropagation()
              cyclePeakMode()
            }}
            title="点击切换统计维度"
            className="flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted border border-border/40"
          >
            <RefreshCw className="size-2.5" />
            <span>切换</span>
          </button>
        }
      >
        {peakMode === "cpu" && (
          <>
            <div className="tnum text-2xl font-semibold tracking-tight text-foreground">
              {topCpuNode?.metrics ? `${topCpuNode.metrics.cpu.toFixed(1)}%` : "—"}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
              <span className="truncate font-medium text-foreground/85">
                {topCpuNode ? topCpuNode.name : "暂无数据"}
              </span>
            </div>
          </>
        )}

        {peakMode === "mem" && (
          <>
            <div className="tnum text-2xl font-semibold tracking-tight text-foreground">
              {topMemNode?.metrics
                ? `${percent(topMemNode.metrics.mem_used, topMemNode.metrics.mem_total).toFixed(0)}%`
                : "—"}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground truncate">
              <span className="truncate font-medium text-foreground/85">
                {topMemNode ? topMemNode.name : "暂无数据"}
              </span>
              <span className="tnum text-[11px] font-normal">
                {topMemNode?.metrics ? pair(topMemNode.metrics.mem_used, topMemNode.metrics.mem_total) : ""}
              </span>
            </div>
          </>
        )}

        {peakMode === "net" && (
          <>
            <div className="tnum text-2xl font-semibold tracking-tight text-foreground">
              {topNetNode?.metrics
                ? rate(topNetNode.metrics.net_rx + topNetNode.metrics.net_tx)
                : "—"}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground truncate">
              <span className="truncate font-medium text-foreground/85">
                {topNetNode ? topNetNode.name : "暂无数据"}
              </span>
              <span className="tnum text-[11px] font-normal">
                {topNetNode?.metrics ? `↓${rate(topNetNode.metrics.net_rx)}` : ""}
              </span>
            </div>
          </>
        )}

        {peakMode === "uptime" && (
          <>
            <div className="tnum text-xl font-semibold tracking-tight text-foreground truncate">
              {topUptimeNode?.metrics ? uptime(topUptimeNode.metrics.uptime) : "—"}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
              <span className="truncate font-medium text-foreground/85">
                {topUptimeNode ? topUptimeNode.name : "暂无数据"}
              </span>
            </div>
          </>
        )}
      </QuickSettingsTile>

      {/* 3. Traffic Statistics Tile */}
      <QuickSettingsTile
        icon={ArrowDown}
        label="流量计量"
        badge={<span className="text-[11px] text-muted-foreground font-medium">今日汇总</span>}
      >
        <Flow
          down={bytes(sum((n) => n.day_rx))}
          up={bytes(sum((n) => n.day_tx))}
        />
        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-normal">历史累计吞吐</span>
          <span className="tnum font-semibold text-foreground">
            {bytes(sum((n) => n.total_rx + n.total_tx))}
          </span>
        </div>
      </QuickSettingsTile>

      {/* 4. Real-time Bandwidth & Wave Tile */}
      <QuickSettingsTile
        icon={Gauge}
        label="全网瞬时速率"
        badge={
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-ok" /> 下行
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-sky-400" /> 上行
            </span>
          </div>
        }
      >
        <div className="tnum flex items-baseline justify-between mb-1.5">
          <span className="text-sm font-semibold text-foreground">
            {rate(now.rx + now.tx)}
          </span>
          <span className="text-[11px] text-muted-foreground font-normal">
            ↓ {rate(now.rx)} · ↑ {rate(now.tx)}
          </span>
        </div>
        <ExpressiveWave series={history} />
      </QuickSettingsTile>
    </div>
    </div>
  )
}
