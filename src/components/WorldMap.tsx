import { useMemo, useState } from "react"
import { Globe, X } from "lucide-react"
import type { Node } from "@/lib/api"
import { flagOf } from "@/lib/format"
import { cn } from "@/lib/utils"
import mapdata from "@/lib/mapdata.json"

const MAP_CELL = 6
const MAP_W = mapdata.cols * MAP_CELL
const MAP_H = mapdata.rows * MAP_CELL

function mapX(lon: number) {
  return ((lon + 180) / 360) * MAP_W
}

function mapY(lat: number) {
  return ((mapdata.latMax - lat) / (mapdata.latMax - mapdata.latMin)) * MAP_H
}

// Generate the SVG land path once at module load time for maximum performance
function buildLandPath(): string {
  const out: string[] = []
  for (let r = 0; r < mapdata.rows; r++) {
    const hex = mapdata.land[r]
    for (let c = 0; c < mapdata.cols; c++) {
      const nib = parseInt(hex.charAt(c >> 2), 16)
      if ((nib >> (3 - (c % 4))) & 1) {
        out.push(`M${((c + 0.5) * MAP_CELL).toFixed(1)} ${((r + 0.5) * MAP_CELL).toFixed(1)}h.01`)
      }
    }
  }
  return out.join("")
}
const LAND_PATH = buildLandPath()

export function WorldMap({
  nodes,
  isOpen,
  onClose,
  isModal = true,
}: {
  nodes: Node[]
  isOpen?: boolean
  onClose?: () => void
  isModal?: boolean
}) {
  const [activeCc, setActiveCc] = useState<string | null>(null)

  // Group nodes by country code using exact centroids
  const clusters = useMemo(() => {
    if (isModal && !isOpen) return []

    const map = new Map<
      string,
      {
        cc: string
        flag: string
        x: number
        y: number
        total: number
        online: number
        nodes: Node[]
      }
    >()

    const ccCoords = mapdata.cc as unknown as Record<string, [number, number]>

    for (const node of nodes) {
      if (!node.country) continue
      const cc = node.country.toUpperCase()
      const pt = ccCoords[cc]
      if (!pt) continue

      const existing = map.get(cc) || {
        cc,
        flag: flagOf(cc),
        x: mapX(pt[0]),
        y: mapY(pt[1]),
        total: 0,
        online: 0,
        nodes: [],
      }
      existing.total++
      if (node.online) existing.online++
      existing.nodes.push(node)
      map.set(cc, existing)
    }

    return Array.from(map.values())
  }, [nodes, isModal, isOpen])

  if (isModal && !isOpen) return null

  const selectedCluster = clusters.find((c) => c.cc === activeCc)

  const mapContent = (
    <div className="space-y-4">
      {/* Natural Earth 110m World Map SVG */}
      <div className="relative aspect-[2.5/1] w-full max-h-[380px] overflow-hidden rounded-xl bg-muted/25 p-3 sm:p-5 border border-border/40 flex items-center justify-center select-none">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="size-full overflow-visible select-none"
          role="img"
          aria-label="节点分布世界地图"
        >
          {/* Authentic Natural Earth landmass dots */}
          <path
            d={LAND_PATH}
            className="stroke-foreground/20 dark:stroke-foreground/15"
            strokeWidth={4.8}
            strokeLinecap="round"
            fill="none"
            style={{ shapeRendering: "optimizeSpeed" }}
          />

          {/* Regional Server Cluster Beacon Pins */}
          {clusters.map((c) => {
            const isAllOnline = c.online === c.total
            const isNoneOnline = c.online === 0
            const toneColor = isAllOnline
              ? "var(--color-ok)"
              : isNoneOnline
              ? "var(--color-destructive)"
              : "var(--color-warn)"
            const isSelected = activeCc === c.cc

            return (
              <g
                key={c.cc}
                className="cursor-pointer transition-transform duration-150"
                onClick={() => setActiveCc(isSelected ? null : c.cc)}
              >
                {/* Soft glow halo */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 16 : 10}
                  fill={toneColor}
                  opacity={isSelected ? 0.35 : 0.22}
                />

                {/* Core Beacon */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 7 : 5}
                  fill={toneColor}
                  stroke="var(--color-card)"
                  strokeWidth="2"
                />

                {/* Tag pill */}
                <text
                  x={c.x}
                  y={c.y - 11}
                  textAnchor="middle"
                  className={cn(
                    "text-[10px] font-semibold select-none pointer-events-none",
                    isSelected ? "fill-primary font-semibold" : "fill-foreground font-medium"
                  )}
                >
                  {c.flag} {c.cc} ({c.online}/{c.total})
                </text>
              </g>
            )
          })}
        </svg>

        {/* Selected Cluster Node List Popover */}
        {selectedCluster && (
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 rounded-2xl bg-card p-3.5 border border-primary/40 shadow-xl max-w-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{selectedCluster.flag}</span>
                <span className="text-xs font-semibold text-foreground">
                  {selectedCluster.cc} 地区机房
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {selectedCluster.online}/{selectedCluster.total} 在线
                </span>
              </div>
              <button
                onClick={() => setActiveCc(null)}
                className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs">
              {selectedCluster.nodes.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        n.online ? "bg-ok" : "bg-destructive"
                      )}
                    />
                    <span className="truncate font-semibold text-foreground">{n.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold shrink-0">
                    {n.online ? "正常" : "离线"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Region Badges Row */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-bold text-muted-foreground mr-1">已接入地区：</span>
        {clusters.map((c) => {
          const isSelected = activeCc === c.cc
          return (
            <button
              key={c.cc}
              onClick={() => setActiveCc(isSelected ? null : c.cc)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 border cursor-pointer active:scale-95",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card hover:bg-muted text-foreground border-border/40"
              )}
            >
              <span>{c.flag}</span>
              <span>{c.cc}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px]">
                {c.online}/{c.total}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60">
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-card p-5 sm:p-7 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Globe className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  节点分布世界地图
                </h3>
                <p className="text-xs text-muted-foreground font-normal">
                  Natural Earth 地理拓扑 · 覆盖 {clusters.length} 个地区 · {nodes.length} 台服务器
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-95"
            >
              <X className="size-4" />
            </button>
          </div>
          {mapContent}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4 sm:p-5 shadow-xs">
      {mapContent}
    </div>
  )
}
