import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Server,
  Cpu,
  HardDrive,
  Layers,
  ArrowUpDown,
  Calendar,
  Activity,
  Zap,
} from "lucide-react"
import {
  Area, AreaChart, Brush, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"

import { Skeleton } from "@/components/Skeleton"
import { Country, Status } from "@/components/NodeCard"
import { api, type Node } from "@/lib/api"
import {
  axisBytes, axisTop, bytes, clockFor, despike, quarters, cpuName, CYCLES, FOREVER, money, osName, rate,
  timeTicks,
} from "@/lib/format"
import { cn } from "@/lib/utils"

type Point = {
  ts: number
  cpu: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
}
// `latency` is the bucket's median round trip, null when every probe in it timed
// out. `band` is the range its answers spanned, absent when they spanned nothing.
// `loss` is the percentage that timed out, absent when none did.
type PingPoint = {
  task_id: number
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}
/** Probe names by id, sent alongside the samples they label. */
type Probes = Record<string, string>
/**
 * Proportion of the whole window each probe lost, by id, absent for probes that
 * lost nothing. Sent because it cannot be derived here: every bucket's `loss` is
 * already a percentage of that bucket, so the sample counts it was divided by are
 * unavailable. Averaging them would weight a bucket holding one sample equally
 * with one holding twelve, and the window's first and last buckets are partial
 * regardless of what the probe does.
 */
type Loss = Record<string, number>

const RANGES = [
  { hours: 1, label: "1 小时" },
  { hours: 6, label: "6 小时" },
  { hours: 24, label: "24 小时" },
  { hours: 168, label: "7 天" },
]

// Latency stops at a day. A week-wide bucket would still carry the spread and the
// loss figure, but a week of probe history is outside this page's purpose, and
// these are the windows in which every ping remains on the chart.
const RANGES_FOR = { resources: RANGES, latency: RANGES.filter((r) => r.hours <= 24) }

const AXIS = { fontSize: 10, tickLine: false, axisLine: false, fill: "var(--color-muted-foreground)", stroke: "none" }

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--color-card, #1c1d22)",
    borderColor: "var(--color-border, rgba(255, 255, 255, 0.15))",
    borderRadius: "1rem",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.35)",
    padding: "8px 12px",
    fontSize: 12,
  },
  itemStyle: {
    color: "var(--color-foreground, #f1f3f4)",
    fontSize: 12,
    fontWeight: 500,
  },
  labelStyle: {
    color: "var(--color-muted-foreground, #9aa0a6)",
    fontSize: 11,
    marginBottom: 4,
  },
}

// No grow-in animation: it would spend 1.5 s drawing a line across the panel on
// every range change, on a page meant to be read at a glance, and on the latency
// chart across seven hundred points per probe.
const SERIES = { dot: false as const, strokeWidth: 1.5, isAnimationActive: false }

// One width for every stacked panel's value axis (increased to 64px to prevent text wrapping on mobile).
const Y_WIDTH = 64

// The palette is greyscale, so lightness alone is exhausted after two or three
// series and the dash pattern carries the rest.
const PALETTE = [
  { stroke: "var(--color-chart-1)", dash: undefined },
  { stroke: "var(--color-chart-3)", dash: "6 3" },
  { stroke: "var(--color-chart-2)", dash: "2 3" },
  { stroke: "var(--color-chart-4)", dash: "10 4 2 4" },
  { stroke: "var(--color-chart-5)", dash: "1 4" },
]

const TABS = [
  { key: "resources", label: "资源指标" },
  { key: "latency", label: "网络延迟" },
] as const

function Panel({
  title,
  icon: Icon = Activity,
  children,
}: {
  title: string
  icon?: typeof Activity
  children: React.ReactNode
}) {
  return (
    <div className="glass-card rounded-3xl border border-border/50 p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <Icon className="size-3.5 text-primary" />
          {title}
        </h4>
      </div>
      <div className="h-40 sm:h-48 w-full text-muted-foreground">{children}</div>
    </div>
  )
}

/**
 * How many samples of a probe's own series make up seven minutes of neighbours.
 */
function despikeWindow(points: { ts: number }[]): number {
  let step = Infinity
  for (let i = 1; i < points.length; i++) step = Math.min(step, points[i].ts - points[i - 1].ts)
  return Math.min(15, Math.max(3, Math.round(420 / step) | 1))
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Server
  label: string
  value?: string | number | null
}) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="glass-card min-w-0 rounded-2xl p-3 sm:p-3.5 border border-border/50 shadow-2xs flex flex-col justify-between gap-1.5 transition-all hover:border-primary/40">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-3.5 text-primary shrink-0" />}
        <dt className="text-[10px] sm:text-[11px] font-medium truncate">{label}</dt>
      </div>
      <dd className="tnum truncate text-xs sm:text-sm font-semibold text-foreground tracking-tight">{value}</dd>
    </div>
  )
}

export function NodeDetail({ node }: { node: Node }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("resources")
  // Each tab keeps its own range: a 7-day trend and a 1-hour trace answer
  // different questions.
  const [ranges, setRanges] = useState({ resources: 6, latency: 6 })
  const hours = ranges[tab]
  const [smooth, setSmooth] = useState(false)
  // Probes switched off. Hiding a slow one is what makes the fast ones readable,
  // as the axis rescales to what remains.
  const [hiddenProbes, setHiddenProbes] = useState<number[]>([])
  const [data, setData] = useState<{ metrics: Point[]; ping: PingPoint[]; probes: Probes; loss?: Loss } | null>(null)
  // Retained rather than folded into an empty result: a refused request and an
  // empty window are different answers, and the hub has reason to refuse this one
  // -- it caps how many history windows it builds concurrently, since each holds
  // the connection the agents report through. Rendered as an empty window, a 503
  // would misdirect the reader.
  const [failed, setFailed] = useState("")
  // Where the brush has been dragged, so the axis reticks for the visible span
  // rather than retaining the whole window's ticks.
  const [zoom, setZoom] = useState<[number, number] | null>(null)

  useEffect(() => {
    let active = true
    // The charts must not continue drawing the old range while the new one is in
    // flight.
    // oxlint-disable-next-line react/set-state-in-effect
    setData(null)
    // oxlint-disable-next-line react/set-state-in-effect
    setZoom(null)
    // oxlint-disable-next-line react/set-state-in-effect
    setFailed("")
    // What this screen can resolve, in device pixels, which is the unit the line
    // is drawn in: a 1280-wide retina panel has 2560 of them for a day of minutes.
    // Read here rather than from a ref, since the hub only thins further, an
    // approximate figure suffices, and the viewport is known before layout. A
    // rotation keeps whatever it fetched with.
    //
    // The tab determines which half is requested; the other accounted for a third
    // to two thirds of every response and was never drawn.
    const points = Math.round(globalThis.innerWidth * (globalThis.devicePixelRatio || 1))
    const series = tab === "latency" ? "ping" : "metrics"
    api<{ metrics: Point[]; ping: PingPoint[]; probes: Probes; loss?: Loss }>(
      `/nodes/${node.id}/metrics?hours=${hours}&points=${points}&series=${series}`,
    )
      .then((next) => { if (active) setData(next) })
      .catch((e: Error) => {
        // `|| "..."` as in App.tsx: HTTP/2 dropped statusText, so a bodiless
        // failure from a proxy arrives as the empty string and renders as no
        // error.
        if (active) { setFailed(e.message || "网络错误"); setData({ metrics: [], ping: [], probes: {} }) }
      })
    return () => { active = false }
  }, [node.id, hours, tab])

  const m = node.metrics
  // One series per probe that reported, labelled from the names the samples
  // arrived with. Memoised, as are the two below: the node prop changes every few
  // seconds as live metrics arrive, and rebuilding the chart's data array on those
  // renders would reset the brush.
  const pingSeries = useMemo(
    () =>
      [...new Set((data?.ping ?? []).map((p) => p.task_id))]
        .map((id) => {
          // Timeouts are retained: dropping them would draw a probe losing half
          // its packets as an unbroken line, and one that never answered not at
          // all.
          const points = (data?.ping ?? []).filter((p) => p.task_id === id)
          // Taken from the hub rather than summed from the buckets above, each of
          // which is already a percentage of its own bucket, so averaging them
          // would report one lost round in thirteen as 50%. Left unrounded, since
          // `Math.round` would render 0.28% and 0.00% as the same badge, and the
          // absence of a badge denotes no loss.
          const loss = data?.loss?.[id] ?? 0
          return { id, name: data?.probes?.[id] ?? `探测 ${id}`, points, loss }
        })
        .filter((s) => s.points.length > 0),
    [data],
  )

  // The hub answers in seconds; the time axis requires milliseconds.
  const metricRows = useMemo(
    () => (data?.metrics ?? []).map((m) => ({ ...m, ts: m.ts * 1_000 })),
    [data],
  )

  // Axis tops for the two panels with no capacity to measure against. CPU and a
  // transfer rate do not express fullness: against a fixed 0-100, a machine
  // sitting at 0.4% draws as a line along the panel's floor. Memory and disk keep
  // their totals as tops, where fullness is the entire question.
  const tops = useMemo(() => {
    const max = (pick: (m: Point) => number) =>
      metricRows.reduce((hi, m) => Math.max(hi, pick(m)), 0)
    return {
      // A floor of 4%, or a machine that never exceeds 0.4% would get an axis of
      // 0-0.4 and render every scheduler blip as a peak. Capped at 100.
      cpu: axisTop(max((m) => m.cpu), 4, 10, 100),
      // Base 1024, so the steps are round in the unit `axisBytes` prints.
      rate: axisTop(max((m) => Math.max(m.net_rx, m.net_tx)), 1024, 1024),
    }
  }, [metricRows])

  const shownProbes = useMemo(
    () => pingSeries.filter((s) => !hiddenProbes.includes(s.id)),
    [pingSeries, hiddenProbes],
  )
  // Keyed on the full list, so a line keeps its shade when others are hidden.
  const style = (id: number) => PALETTE[pingSeries.findIndex((p) => p.id === id) % PALETTE.length]

  // The hub stamps every sample with its bucket rather than the second the probe
  // finished, so probes reporting at the bucket's rate share rows instead of each
  // contributing its own: a day of four probes is 717 rows rather than 2,868. A
  // slower probe leaves gaps in its own column, which is what `connectNulls`
  // addresses.
  //
  // Every probe and both versions of every sample are held here whether or not
  // they are on screen: recharts resets the brush when the data array changes
  // identity, and re-reads a controlled selection only when the index props
  // change, which they do not. Hiding a probe or enabling despiking therefore
  // selects a `dataKey` rather than rebuilding the array.
  const pingRows = useMemo(() => {
    const rows = new Map<
      number,
      { ts: number } & Record<string, number | [number, number] | null>
    >()
    for (const s of pingSeries) {
      const windowSize = despikeWindow(s.points)
      const smoothed = despike(s.points.map((p) => p.latency), windowSize)
      // The band spans the same outliers as the line, and with one probe on
      // screen it is what the axis is fitted to, so it is clipped alongside it
      // rather than left to pull the axis back open. The latency fills the
      // buckets that carry no band, keeping each filter's window dense.
      const lo = despike(s.points.map((p) => p.band?.[0] ?? p.latency), windowSize)
      const hi = despike(s.points.map((p) => p.band?.[1] ?? p.latency), windowSize)
      s.points.forEach((p, i) => {
        const row = rows.get(p.ts) ?? { ts: p.ts * 1_000 }
        row[`t${s.id}`] = p.latency
        row[`s${s.id}`] = smoothed[i]
        row[`l${s.id}`] = p.loss ?? 0
        // A bucket with a single answer carries no band and spans only that
        // answer. Left null, `connectNulls` would bridge the hours between the
        // few buckets that have one: 2 to 10 of 1,440 in a day, the widest gap
        // 803 minutes, drawn as one large wedge.
        row[`b${s.id}`] = p.band ?? (p.latency === null ? null : [p.latency, p.latency])
        // Taken as the span of three filtered series rather than a pair: the two
        // edges are filtered independently, so a bucket that answered slightly
        // faster than usual can trip the low edge alone and come back above the
        // high one -- [180, 178] against a line of 176, drawn backwards with the
        // line outside it.
        const [low, high] = [lo[i], hi[i]]
        row[`c${s.id}`] =
          low === null || high === null
            ? null
            : [Math.min(low, high, smoothed[i] ?? low), Math.max(low, high, smoothed[i] ?? high)]
        rows.set(p.ts, row)
      })
    }
    return [...rows.values()].sort((a, b) => a.ts - b.ts)
  }, [pingSeries])

  // A real time axis rather than the category axis recharts defaults to: on a
  // category axis ticks are selected by index, so a period the agent was offline
  // for collapses to nothing.
  const timeAxis = (rows: { ts: number }[], from = 0, to = rows.length - 1) => ({
    dataKey: "ts",
    type: "number" as const,
    domain: ["dataMin", "dataMax"] as const,
    // Explicit, or recharts places them at 05:14 and 10:22. Any that still collide
    // are dropped by `minTickGap`.
    ticks: rows.length > 0 && rows[from] && rows[to] ? timeTicks(rows[from].ts, rows[to].ts) : undefined,
    tickFormatter: clockFor(hours),
    minTickGap: hours > 24 ? 72 : 40,
    ...AXIS,
  })

  return (
    <div className="space-y-4 sm:space-y-5 select-none">
      {/* Top Slim Capsule Navigation & Node Info Header */}
      <div className="glass-card rounded-full border border-border/50 px-3.5 sm:px-4 py-2 shadow-xs flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            onClick={() => history.back()}
            title="返回总览列表"
            className="flex h-8 items-center gap-1.5 rounded-full bg-muted/70 hover:bg-muted text-foreground px-2.5 sm:px-3 text-xs font-semibold transition-all active:scale-95 border border-border/40 cursor-pointer shadow-2xs shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">返回</span>
          </button>
          <Country node={node} />
          <h2 className="truncate text-sm sm:text-base font-bold tracking-tight text-foreground">
            {node.name}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Status node={node} />
          {node.agent_version && (
            <span className="hidden xs:inline-block rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/40">
              v{node.agent_version}
            </span>
          )}
        </div>
      </div>

      {/* Hardware Specs Grid (2 cols on mobile, 3 cols on desktop) */}
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 select-none">
        <Fact icon={Server} label="操作系统" value={[osName(node.os), node.kernel].filter(Boolean).join(" · ")} />
        <Fact
          icon={Cpu}
          label="处理器规格"
          value={node.cpu_name ? `${cpuName(node.cpu_name)} × ${node.cpu_cores}` : `${node.cpu_cores} 核`}
        />
        <Fact icon={HardDrive} label="内存 / 硬盘总容" value={`${bytes(node.mem_total)} / ${bytes(node.disk_total)}`} />
        <Fact
          icon={Layers}
          label="系统架构与进程"
          value={[node.arch, node.virt !== "none" ? node.virt : "", m ? `${m.procs} 进程` : ""]
            .filter(Boolean)
            .join(" · ")}
        />
        <Fact icon={ArrowUpDown} label="今日吞吐流量" value={`↓ ${bytes(node.day_rx)} · ↑ ${bytes(node.day_tx)}`} />
        <Fact
          icon={Calendar}
          label="计费与到期周期"
          value={[
            node.price > 0
              ? `${money(node.price, node.currency)} / ${CYCLES[node.billing_cycle] ?? node.billing_cycle}`
              : "免费",
            node.expires_at ? `${node.expires_at} 到期` : FOREVER,
          ].join(" · ")}
        />
      </dl>

      {node.remark && (
        <div className="glass-card rounded-2xl border border-border/40 p-3 sm:p-4 text-xs text-foreground/80 leading-relaxed">
          <span className="font-semibold text-foreground mr-1.5">备注信息:</span>
          <span className="whitespace-pre-wrap">{node.remark}</span>
        </div>
      )}

      {/* Tabs & Time Range Segmented Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Main Category Tabs */}
        <div className="pill-bar inline-flex h-10 items-center rounded-full bg-muted/60 p-1 border border-border/40 gap-1 select-none shrink-0">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 sm:px-4 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.key === "resources" ? <Activity className="size-3.5" /> : <Zap className="size-3.5" />}
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Range Selector & Latency Filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          <div className="pill-bar inline-flex h-10 items-center rounded-full bg-muted/60 p-1 border border-border/40 gap-0.5 select-none shrink-0">
            {RANGES_FOR[tab].map((r) => {
              const active = hours === r.hours
              return (
                <button
                  key={r.hours}
                  type="button"
                  onClick={() => setRanges((all) => ({ ...all, [tab]: r.hours }))}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              )
            })}
          </div>

          {tab === "latency" && (
            <label className="inline-flex h-10 items-center gap-1.5 rounded-full bg-card/90 border border-border/50 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none shrink-0 shadow-2xs">
              <input
                type="checkbox"
                checked={smooth}
                onChange={(e) => setSmooth(e.target.checked)}
                className="accent-primary rounded size-3.5 cursor-pointer"
              />
              <span className="text-xs font-medium">削峰</span>
            </label>
          )}
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-40 w-full rounded-3xl" />
      ) : failed ? (
        <p className="py-8 text-center text-sm text-destructive" role="alert">读取历史数据失败：{failed}</p>
      ) : tab === "latency" ? (
        pingSeries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">这段时间没有延迟数据</p>
        ) : (
          <div className="glass-card flex min-h-[380px] sm:min-h-[460px] flex-col gap-3 rounded-3xl border border-border/50 p-4 sm:p-5 shadow-xs">
            {/* `min-h-0` is what makes `flex-1` a real number rather than the
                content's own height: ResponsiveContainer reads its parent, and
                a flex child not told it may shrink reports whatever the SVG
                last was. The column above has a height in pixels, so this
                resolves at layout instead of coming back 0. */}
            <div className="w-full h-[320px] sm:h-[400px] text-muted-foreground">
              {shownProbes.length === 0 ? (
                <p className="py-8 text-center text-sm">没有选中任何探测</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                  <ComposedChart data={pingRows}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis
                      {...timeAxis(
                        pingRows,
                        Math.min(zoom?.[0] ?? 0, Math.max(0, pingRows.length - 1)),
                        Math.min(zoom?.[1] ?? (pingRows.length ? pingRows.length - 1 : 0), Math.max(0, pingRows.length - 1)),
                      )}
                    />
                    {/* Not anchored at zero: these lines live in a narrow band
                        far from it, and zero flattens every wobble. */}
                    <YAxis
                      width={56}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${Math.round(v)}ms`}
                      {...AXIS}
                      tick={{ fill: "currentColor", fontSize: 10 }}
                    />
                    <Tooltip
                      labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                      // The line is drawn from what answered, so without this a
                      // bucket that lost most of its packets reads as normal.
                      // `dataKey` is `t7`/`s7`; the loss sits at `l7`.
                      //
                      // Rounded because a clipped sample carries the median of
                      // an even window, which falls between two of the whole
                      // milliseconds the hub stores.
                      formatter={(v, name, item) => {
                        const loss = Number(item?.payload?.[`l${String(item.dataKey).slice(1)}`] ?? 0)
                        return [`${Math.round(Number(v))} ms${loss > 0 ? ` · 丢 ${loss}%` : ""}`, name]
                      }}
                      {...TOOLTIP_STYLE}
                    />
                    {/* Behind the line, the range that bucket's answers
                        spanned -- Smokeping's "smoke". At the day window a
                        bucket moves 63 ms at the 90th percentile against the
                        25 ms the trend moves, so a line alone draws the smaller
                        of the two.

                        Only with one probe on screen: rendered for four, the
                        bands overlap into a fog and their extremes drag the
                        axis from 165-385 out to 140-420. */}
                    {shownProbes.length === 1 &&
                      shownProbes.map((s) => (
                        <Area
                          key={`band${s.id}`}
                          dataKey={`${smooth ? "c" : "b"}${s.id}`}
                          stroke="none"
                          fill={style(s.id).stroke}
                          fillOpacity={0.16}
                          isAnimationActive={false}
                          tooltipType="none"
                          legendType="none"
                          connectNulls
                        />
                      ))}
                    {shownProbes.map((s) => (
                      <Line
                        key={s.id}
                        dataKey={`${smooth ? "s" : "t"}${s.id}`}
                        name={s.name}
                        stroke={style(s.id).stroke}
                        strokeDasharray={style(s.id).dash}
                        {...SERIES}
                        connectNulls
                      />
                    ))}
                    {/* Drag either handle to zoom into a stretch of the trend. */}
                    {pingRows.length >= 2 && (
                      <Brush
                        dataKey="ts"
                        height={20}
                        travellerWidth={6}
                        tickFormatter={clockFor(hours)}
                        fill="transparent"
                        stroke="var(--color-border)"
                        onChange={(r) => setZoom([r.startIndex ?? 0, r.endIndex ?? Math.max(0, pingRows.length - 1)])}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Under the chart: what it covers is picked at the top, what is
                drawn in it is picked here. Recharts paints the brush into the
                same SVG as the axis, so this is as close beneath as HTML
                sits. */}
            {(pingSeries.length > 1 || pingSeries.some((s) => s.loss > 0)) && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-border/30">
              {pingSeries.map((s) => {
                const shown = !hiddenProbes.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() =>
                      setHiddenProbes((h) => (shown ? [...h, s.id] : h.filter((id) => id !== s.id)))
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 cursor-pointer select-none",
                      shown
                        ? "bg-card hover:bg-muted text-foreground border-border/50 shadow-2xs"
                        : "opacity-40 bg-muted/40 text-muted-foreground border-border/30"
                    )}
                  >
                    {/* The swatch carries the same shade and dash as the line. */}
                    <svg width="14" height="6" className="shrink-0" aria-hidden>
                      <line
                        x1="0"
                        y1="3"
                        x2="14"
                        y2="3"
                        stroke={style(s.id).stroke}
                        strokeDasharray={style(s.id).dash}
                        strokeWidth="2"
                      />
                    </svg>
                    <span>{s.name}</span>
                    {/* The line is only what answered, so a probe dropping
                        half its packets draws like a healthy one. */}
                    {s.loss > 0 && (
                      <span className="tnum text-[10px] text-destructive font-semibold">
                        丢 {s.loss < 1 ? "<1" : Math.round(s.loss)}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            )}
          </div>
        )
      ) : data.metrics.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">这段时间没有历史数据</p>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          <Panel title="CPU 核心负载" icon={Cpu}>
            <ResponsiveContainer>
              <AreaChart data={metricRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis {...timeAxis(metricRows)} />
                <YAxis
                  domain={[0, tops.cpu]}
                  ticks={quarters(tops.cpu)}
                  unit="%"
                  width={Y_WIDTH}
                  {...AXIS}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, "CPU"]}
                  {...TOOLTIP_STYLE}
                />
                <Area dataKey="cpu" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.15} {...SERIES} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          {/* The axis top is the machine's memory, so the line's height is the
              fraction in use whatever range is picked. Tracking the window's
              own maximum, which is what an area chart does by default, puts
              127 MB of a 457 MB box at the top of the panel. The size is in the
              title because the axis top is claiming it. */}
          <Panel title={`内存占用 · 总容 ${bytes(node.mem_total)}`} icon={HardDrive}>
            <ResponsiveContainer>
              <AreaChart data={metricRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis {...timeAxis(metricRows)} />
                <YAxis
                  domain={[0, node.mem_total]}
                  ticks={quarters(node.mem_total)}
                  tickFormatter={(v) => axisBytes(v).replace(" ", "\u00A0")}
                  width={Y_WIDTH}
                  {...AXIS}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                  formatter={(v) => bytes(Number(v))}
                  {...TOOLTIP_STYLE}
                />
                <Area dataKey="mem_used" name="内存" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.15} {...SERIES} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          {/* A rate has no total to be a fraction of, so this one climbs the
              ladder like CPU rather than pinning to a capacity. */}
          <Panel title="全网吞吐速率" icon={Activity}>
            <ResponsiveContainer>
              <LineChart data={metricRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis {...timeAxis(metricRows)} />
                <YAxis
                  domain={[0, tops.rate]}
                  ticks={quarters(tops.rate)}
                  tickFormatter={(v) => (axisBytes(v) + "/s").replace(" ", "\u00A0")}
                  width={Y_WIDTH}
                  {...AXIS}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                  formatter={(v) => rate(Number(v))}
                  {...TOOLTIP_STYLE}
                />
                <Line dataKey="net_rx" name="下行" stroke="var(--color-ok)" {...SERIES} />
                <Line dataKey="net_tx" name="上行" stroke="var(--color-chart-1)" {...SERIES} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          {/* The disk it is filling, for the same reason as memory: a node
              using 2.7% of its disk draws along the top of the panel when the
              axis tracks the window's own maximum. */}
          <Panel title={`硬盘存储 · 总容 ${bytes(node.disk_total)}`} icon={Server}>
            <ResponsiveContainer>
              <AreaChart data={metricRows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis {...timeAxis(metricRows)} />
                <YAxis
                  domain={[0, node.disk_total]}
                  ticks={quarters(node.disk_total)}
                  tickFormatter={(v) => axisBytes(v).replace(" ", "\u00A0")}
                  width={Y_WIDTH}
                  {...AXIS}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(ts) => new Date(Number(ts)).toLocaleString("zh-CN")}
                  formatter={(v) => bytes(Number(v))}
                  {...TOOLTIP_STYLE}
                />
                <Area dataKey="disk_used" name="硬盘" stroke="var(--color-chart-2)" fill="var(--color-chart-2)" fillOpacity={0.15} {...SERIES} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      )}
    </div>
  )
}
