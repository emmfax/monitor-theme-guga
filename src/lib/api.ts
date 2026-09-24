import { useEffect, useState } from "react"

export type LatencyProbeSummary = {
  name: string
  ms: number // 0 indicates timeout / unreachable
  loss: number
  sparkline: number[]
}

export type NodeLatencyInfo = {
  probes: LatencyProbeSummary[]
  sparkline: number[]
  avgMs: number | null
}

export type Metrics = {
  uptime: number
  cpu: number
  load: [number, number, number]
  mem_total: number
  mem_used: number
  swap_total: number
  swap_used: number
  disk_total: number
  disk_used: number
  net_rx: number
  net_tx: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  tcp: number
  udp: number
  procs: number
}

export type Node = {
  id: number
  name: string
  sort: number
  public: boolean
  online: boolean
  country: string
  group?: string
  last_seen: number
  metrics: Metrics | null
  os: string
  kernel: string
  arch: string
  virt: string
  cpu_name: string
  cpu_cores: number
  mem_total: number
  swap_total: number
  disk_total: number
  agent_version: string
  price: number
  currency: string
  billing_cycle: string
  expires_at: string | null
  expires_in?: number | null
  traffic_limit: number
  traffic_mode: string
  traffic_reset_day: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  month_used?: number
  month_start: string
  day_rx: number
  day_tx: number
  hostname?: string
  ip?: string
  remark?: string
}

export function groupsOf(nodes: Pick<Node, "group">[]): string[] {
  return [...new Set(nodes.map((n) => n.group ?? "").filter(Boolean))]
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
  })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()) || res.statusText)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const KEEP = 60
export const speedHistory = new Map<string | null, { rx: number; tx: number }[]>()

export function sample(nodes: Node[]) {
  const totals = new Map<string | null, { rx: number; tx: number }>()
  for (const n of nodes) {
    for (const key of [null, n.group ?? ""]) {
      const total = totals.get(key) ?? { rx: 0, tx: 0 }
      if (n.online && n.metrics) {
        total.rx += n.metrics.net_rx
        total.tx += n.metrics.net_tx
      }
      totals.set(key, total)
    }
  }
  for (const key of speedHistory.keys()) if (!totals.has(key)) speedHistory.delete(key)
  for (const [key, total] of totals) {
    const series = speedHistory.get(key) ?? []
    series.push(total)
    if (series.length > KEEP) series.shift()
    speedHistory.set(key, series)
  }
}

export function safeNodes(nodes: Node[]): Node[] {
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0
  const fields = [
    "uptime",
    "cpu",
    "mem_total",
    "mem_used",
    "swap_total",
    "swap_used",
    "disk_total",
    "disk_used",
    "net_rx",
    "net_tx",
    "total_rx",
    "total_tx",
    "month_rx",
    "month_tx",
    "tcp",
    "udp",
    "procs",
  ] as const
  return nodes.map((node) => {
    const m = node.metrics
    return !m ||
      (fields.every((key) => number(m[key])) &&
        Array.isArray(m.load) &&
        m.load.length === 3 &&
        m.load.every(number))
      ? node
      : { ...node, metrics: null }
  })
}

export function useNodes() {
  const [nodes, setNodes] = useState<Node[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    let socket: WebSocket | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let isTerminated = false

    const receive = (list: Node[]) => {
      const safe = safeNodes(list)
      sample(safe)
      setNodes(safe)
      setError(null)
      setClosed(false)
    }

    const fetchOnce = () =>
      api<{ nodes: Node[] }>("/nodes")
        .then((d) => receive(d.nodes))
        .catch((e: Error) => {
          if (e instanceof ApiError && e.status === 401) {
            setClosed(true)
          } else {
            setError(e.message || "无法连接到监控服务端")
          }
        })

    fetchOnce()

    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`
    const connect = () => {
      try {
        socket = new WebSocket(url)
      } catch {
        poll ??= setInterval(fetchOnce, 5000)
        return
      }
      socket.onmessage = (event) => {
        try {
          receive(JSON.parse(event.data).nodes)
          if (poll) {
            clearInterval(poll)
            poll = null
          }
        } catch {
          // Ignore malformed WS frames
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (isTerminated) return
        poll ??= setInterval(fetchOnce, 5000)
        retry = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      isTerminated = true
      socket?.close()
      if (poll) clearInterval(poll)
      if (retry) clearTimeout(retry)
    }
  }, [])

  return { nodes, error, closed }
}

const latencyCache = new Map<number, NodeLatencyInfo>()
const latencyPending = new Set<number>()
const latencyFetchedAt = new Map<number, number>()

export function useNodeLatency(nodeId: number, online: boolean): NodeLatencyInfo | null {
  const [info, setInfo] = useState<NodeLatencyInfo | null>(() => {
    return latencyCache.get(nodeId) ?? null
  })

  useEffect(() => {
    if (!online) return

    // Cooldown check: if already fetched in last 120s, skip without re-fetching
    const lastFetch = latencyFetchedAt.get(nodeId) ?? 0
    if (latencyCache.has(nodeId) && Date.now() - lastFetch < 120_000) {
      return
    }

    // Deduplication check: if a request for this node is already in flight, skip
    if (latencyPending.has(nodeId)) return
    latencyPending.add(nodeId)

    let active = true
    api<{ ping: { task_id: number; latency: number | null }[]; probes: Record<string, string> }>(
      `/nodes/${nodeId}/metrics?hours=1&points=12&series=ping`
    )
      .then((res) => {
        latencyPending.delete(nodeId)
        latencyFetchedAt.set(nodeId, Date.now())
        if (!active) return

        const pings = res?.ping ?? []
        const probes = res?.probes ?? {}
        const latestProbes = Object.entries(probes).map(([id, name]) => {
          const list = pings.filter((p) => String(p.task_id) === String(id))
          const last = list.at(-1)?.latency ?? 0
          const ms = last && last > 0 ? Math.round(last) : 0 // 0 means timeout!
          const probeSpark = list
            .map((p) => (p.latency && p.latency > 0 ? Math.round(p.latency) : 0))
            .slice(-8)
          return {
            name: name.replace(/\s*\([^)]*\)\s*$/, "").slice(0, 4),
            ms,
            loss: ms === 0 ? 100 : 0,
            sparkline: probeSpark.length >= 2 ? probeSpark : (ms > 0 ? [ms, ms, ms] : [0, 0, 0]),
          }
        })
        const shownProbes = latestProbes.slice(0, 3)
        const validProbes = shownProbes.filter((p) => p.ms > 0)
        const avgMs =
          shownProbes.length === 0
            ? null
            : validProbes.length > 0
            ? Math.round(validProbes.reduce((acc, p) => acc + p.ms, 0) / validProbes.length)
            : 0

        const sparkline = pings.map((p) => p.latency ?? 0).filter((v) => v > 0).slice(-12)
        const result: NodeLatencyInfo = {
          probes: shownProbes,
          sparkline: sparkline.length ? sparkline : [30, 32, 28, 30],
          avgMs,
        }
        latencyCache.set(nodeId, result)
        setInfo(result)
      })
      .catch(() => {
        latencyPending.delete(nodeId)
        latencyFetchedAt.set(nodeId, Date.now())
        if (active) {
          const result: NodeLatencyInfo = {
            probes: [],
            sparkline: [],
            avgMs: null,
          }
          latencyCache.set(nodeId, result)
          setInfo(result)
        }
      })

    return () => {
      active = false
    }
  }, [nodeId, online])

  return latencyCache.get(nodeId) ?? info
}
