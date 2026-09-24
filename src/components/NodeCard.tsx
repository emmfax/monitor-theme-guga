import type { CSSProperties } from "react"
import { ArrowDown, ArrowUp, Activity, Layers, Cpu, HardDrive, ArrowUpDown } from "lucide-react"
import {
  siAlmalinux,
  siAlpinelinux,
  siArchlinux,
  siCentos,
  siDebian,
  siFedora,
  siLinux,
  siOpensuse,
  siRedhat,
  siRockylinux,
  siUbuntu,
  type SimpleIcon,
} from "simple-icons"

import { Meter } from "@/components/Meter"
import { CountryFlag } from "@/components/CountryFlag"
import { useNodeLatency, type Node } from "@/lib/api"
import { bytes, CYCLES, daysUntil, FOREVER, money, osName, pair, percent, rate, uptime } from "@/lib/format"
import { cn } from "@/lib/utils"

const DISTROS: [string, SimpleIcon][] = [
  ["debian", siDebian],
  ["raspbian", siDebian],
  ["ubuntu", siUbuntu],
  ["arch", siArchlinux],
  ["centos", siCentos],
  ["fedora", siFedora],
  ["alpine", siAlpinelinux],
  ["opensuse", siOpensuse],
  ["suse", siOpensuse],
  ["redhat", siRedhat],
  ["rhel", siRedhat],
  ["rocky", siRockylinux],
  ["alma", siAlmalinux],
]

function deployed(node: Node) {
  return node.cpu_cores > 0 || node.mem_total > 0
}

export function StatusPill({ node }: { node: Node }) {
  const down = node.last_seen ? Date.now() / 1000 - node.last_seen : 0
  const label = node.online
    ? `在线 ${node.metrics ? uptime(node.metrics.uptime) : ""}`
    : deployed(node)
    ? `离线 ${down >= 60 ? uptime(down) : ""}`
    : "未接入"

  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors shadow-2xs select-none",
        node.online
          ? "bg-ok/12 text-ok border border-ok/25"
          : deployed(node)
          ? "bg-destructive/12 text-destructive border border-destructive/25"
          : "bg-muted/70 text-muted-foreground border border-border/40"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          node.online ? "bg-ok animate-pulse-dot" : deployed(node) ? "bg-destructive" : "bg-muted-foreground/60"
        )}
      />
      {label.trim()}
    </span>
  )
}

export const Status = StatusPill
export const Country = CountryPill

export function CountryPill({ node }: { node: Node }) {
  if (!node.country) return null
  return <CountryFlag country={node.country} />
}

function OsIcon({ os }: { os: string }) {
  const name = os.toLowerCase()
  const icon = DISTROS.find(([key]) => name.includes(key))?.[1] ?? siLinux
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ "--brand": `#${icon.hex}` } as CSSProperties}
      className="size-3.5 shrink-0 fill-(--brand) dark:fill-[color-mix(in_oklab,var(--brand)_65%,white)]"
    >
      <path d={icon.path} />
    </svg>
  )
}

function trafficFoot(node: Node) {
  return node.traffic_limit > 0
    ? pair(monthUsage(node), node.traffic_limit)
    : `${bytes(monthUsage(node))} / ${FOREVER}`
}

function monthUsage(node: Node): number {
  return node.month_used !== undefined ? node.month_used : (node.month_rx ?? 0) + (node.month_tx ?? 0)
}

function ExpiryPill({ node }: { node: Node }) {
  const days =
    node.expires_in !== undefined && node.expires_in !== null
      ? node.expires_in
      : daysUntil(node.expires_at)

  if (days === null) {
    return (
      <span className="rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/30 select-none">
        永久有效 ∞
      </span>
    )
  }
  const isExpired = days < 0
  const isToday = days === 0
  const isExpiringSoon = days > 0 && days <= 7

  return (
    <span
      className={cn(
        "tnum rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors select-none",
        isExpired
          ? "bg-destructive/15 text-destructive border-destructive/30 font-semibold"
          : isToday
          ? "bg-destructive/15 text-destructive border-destructive/30 font-semibold animate-pulse"
          : isExpiringSoon
          ? "bg-warn/15 text-warn border-warn/30 font-semibold"
          : "bg-muted/40 text-muted-foreground border-border/30"
      )}
    >
      {isExpired ? `已过期 ${-days} 天` : isToday ? "今日到期" : `${days} 天后到期`}
    </span>
  )
}

function PricePill({ node }: { node: Node }) {
  if (!node.price || node.price <= 0) return null
  const cycleText = CYCLES[node.billing_cycle] ?? node.billing_cycle ?? "月付"
  return (
    <span className="tnum rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/30 select-none">
      {money(node.price, node.currency)} / {cycleText}
    </span>
  )
}

function ProbeSparkline({
  points,
  color,
  isTimeout,
}: {
  points?: number[]
  color: string
  isTimeout: boolean
}) {
  if (isTimeout || !points || points.length < 2) {
    return (
      <div className="h-3 w-full flex items-center">
        <div className="w-full border-t border-dashed border-destructive/35" />
      </div>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(max - min, 4)
  const len = Math.max(points.length - 1, 1)

  const d = points
    .map((v, i) => {
      const x = (i / len) * 50
      const y = 14 - ((v - min) / range) * 11
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <div className="h-3.5 w-full overflow-hidden">
      <svg viewBox="0 0 50 16" preserveAspectRatio="none" className="size-full overflow-visible" aria-hidden>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

function LatencySection({ nodeId, online }: { nodeId: number; online: boolean }) {
  const latency = useNodeLatency(nodeId, online)

  if (!online) {
    return (
      <div className="min-h-[96px] flex flex-col justify-between space-y-1.5 select-none">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted-foreground">网络延迟监控</span>
          <span className="text-[10px] text-muted-foreground font-semibold">节点已离线</span>
        </div>
        <div className="flex items-center justify-center rounded-xl bg-muted/20 h-[62px] text-xs text-muted-foreground/75 font-medium border border-border/25">
          节点已离线，暂无实时连通数据
        </div>
      </div>
    )
  }

  if (latency === null) {
    return (
      <div className="min-h-[96px] flex flex-col justify-between space-y-1.5 select-none">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted-foreground">网络延迟监控</span>
          <span className="text-[10px] text-primary font-semibold">读取中…</span>
        </div>
        <div className="flex items-center justify-center rounded-xl bg-muted/20 h-[62px] text-xs text-muted-foreground font-medium border border-border/25">
          正在读取该节点多路探测指标…
        </div>
      </div>
    )
  }

  const probes = latency.probes
  if (!probes || probes.length === 0) {
    return (
      <div className="min-h-[96px] flex flex-col justify-between space-y-1.5 select-none">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-muted-foreground">网络延迟监控</span>
          <span className="text-[10px] text-muted-foreground font-semibold">未配置探测</span>
        </div>
        <div className="flex items-center justify-center rounded-xl bg-muted/20 h-[62px] text-xs text-muted-foreground font-medium border border-border/25">
          该节点暂未配置三方延迟探测
        </div>
      </div>
    )
  }

  const shown = probes.slice(0, 3)
  const avgMs = latency.avgMs ?? 0

  return (
    <div className="min-h-[96px] flex flex-col justify-between space-y-2 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Activity className="size-3.5 text-primary" />
          <span>网络延迟监控</span>
        </div>
        <span
          className={cn(
            "tnum text-[11px] font-medium",
            avgMs <= 0
              ? "text-destructive"
              : avgMs <= 50
              ? "text-ok"
              : avgMs <= 120
              ? "text-warn"
              : "text-destructive"
          )}
        >
          {avgMs <= 0 ? "全部超时" : `平均 ${avgMs}ms`}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-2",
          shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        {shown.map((p, idx) => {
          const isTimeout = p.ms <= 0
          const isGood = !isTimeout && p.ms <= 50
          const isFair = !isTimeout && p.ms <= 120
          const ratingLabel = isTimeout ? "超时" : isGood ? "极速" : isFair ? "良好" : "普通"
          const ratingColor = isTimeout
            ? "text-destructive font-semibold"
            : isGood
            ? "text-ok font-semibold"
            : isFair
            ? "text-sky-400 font-semibold"
            : "text-amber-400 font-semibold"
          const strokeColor = isTimeout
            ? "var(--color-destructive)"
            : isGood
            ? "var(--color-ok)"
            : isFair
            ? "#38bdf8"
            : "#fbbf24"

          return (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl bg-muted/40 dark:bg-white/[0.04] border border-border/40 dark:border-white/10 p-2.5 text-left min-h-[62px]"
            >
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className="truncate font-medium text-muted-foreground dark:text-zinc-400">{p.name}</span>
                <span className={cn("text-[9px] font-semibold uppercase", ratingColor)}>{ratingLabel}</span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <span
                  className={cn(
                    "tnum text-xs font-semibold tracking-tight",
                    isTimeout ? "text-muted-foreground" : "text-foreground dark:text-white"
                  )}
                >
                  {isTimeout ? "--" : p.ms}
                  <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
                    {isTimeout ? "" : "ms"}
                  </span>
                </span>
              </div>

              <div className="mt-1">
                <ProbeSparkline points={p.sparkline} color={strokeColor} isTimeout={isTimeout} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function NodeCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const m = node.metrics

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="glass-card group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border/50 p-4.5 sm:p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.99] cursor-pointer select-none"
    >
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Top Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <CountryFlag country={node.country} />
                <h3 className="truncate text-base sm:text-lg font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                  {node.name}
                </h3>
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground font-normal">
                {node.os && <OsIcon os={node.os} />}
                <span className="truncate">
                  {node.os ? osName(node.os) : "等待首次上报"}
                  {node.virt && node.virt !== "none" ? ` · ${node.virt}` : ""}
                  {node.arch ? ` · ${node.arch}` : ""}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusPill node={node} />
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <PricePill node={node} />
                <ExpiryPill node={node} />
              </div>
            </div>
          </div>

          {deployed(node) ? (
            <>
              {/* 4 Chunky Capsule Volume Sliders */}
              <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-x-3.5 gap-y-3">
                <Meter
                  icon={<Cpu className="size-3 text-muted-foreground/80 shrink-0" />}
                  label={`CPU ${node.cpu_cores}核`}
                  pct={m ? m.cpu : null}
                  foot={m ? m.load.map((n) => n.toFixed(2)).join(" ") : "—"}
                />
                <Meter
                  icon={<Layers className="size-3 text-muted-foreground/80 shrink-0" />}
                  label="内存"
                  pct={m ? percent(m.mem_used, m.mem_total) : null}
                  foot={m ? pair(m.mem_used, m.mem_total) : bytes(node.mem_total)}
                />
                <Meter
                  icon={<HardDrive className="size-3 text-muted-foreground/80 shrink-0" />}
                  label="存储"
                  pct={m ? percent(m.disk_used, m.disk_total) : null}
                  foot={m ? pair(m.disk_used, m.disk_total) : bytes(node.disk_total)}
                />
                <Meter
                  icon={<ArrowUpDown className="size-3 text-muted-foreground/80 shrink-0" />}
                  label="流量"
                  pct={node.traffic_limit > 0 ? percent(monthUsage(node), node.traffic_limit) : null}
                  empty={FOREVER}
                  foot={trafficFoot(node)}
                />
              </div>

              {/* Prominent Dedicated Latency Section */}
              <div className="mt-4">
                <LatencySection nodeId={node.id} online={node.online} />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed border border-border/30">
              节点未建立长连接。请在管理后台生成接入指令并执行。
            </div>
          )}
        </div>

        {/* Clean Airy Network Footer */}
        {deployed(node) && (
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs select-none">
            {/* Left: 实时速率 */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                <Activity className="size-3 text-ok" />
                速率:
              </span>
              <div className="flex items-center gap-1.5 tnum font-semibold text-[10px] sm:text-[11px]">
                <span className="text-ok flex items-center gap-0.5">
                  <ArrowDown className="size-2.5" />
                  {m ? rate(m.net_rx) : "0 B/s"}
                </span>
                <span className="text-sky-400 flex items-center gap-0.5">
                  <ArrowUp className="size-2.5" />
                  {m ? rate(m.net_tx) : "0 B/s"}
                </span>
              </div>
            </div>

            {/* Right: 累计总流量 */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                <Layers className="size-3 text-muted-foreground" />
                总流量:
              </span>
              <div className="flex items-center gap-1.5 tnum font-normal text-foreground dark:text-zinc-200 text-[10px] sm:text-[11px]">
                <span className="flex items-center gap-0.5">
                  <ArrowDown className="size-2.5 text-muted-foreground/80" />
                  {bytes(node.total_rx)}
                </span>
                <span className="flex items-center gap-0.5">
                  <ArrowUp className="size-2.5 text-muted-foreground/80" />
                  {bytes(node.total_tx)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
