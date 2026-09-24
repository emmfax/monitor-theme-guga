import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  Wrench,
  Search,
  Sparkles,
  X,
  Flame,
  Hourglass,
  SlidersHorizontal,
  Globe,
  LayoutGrid,
  Grid3X3,
  List,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react"

import { NodeCard } from "@/components/NodeCard"
import { NodeCompactCard } from "@/components/NodeCompactCard"
import { NodeListRow } from "@/components/NodeListRow"
import { Summary } from "@/components/Summary"
import { WorldMap } from "@/components/WorldMap"
import { Skeleton } from "@/components/Skeleton"
import { SettingsModal, type ThemeMode, type CardStyle, type ViewMode } from "@/components/SettingsModal"
import { api, groupsOf, useNodes, type Node } from "@/lib/api"
import { loadConfig, type Palette, type ThemeConfig } from "@/lib/config"
import { cn } from "@/lib/utils"

type Me = { authed: boolean; github: boolean; site_name: string; public_page: boolean }

const loadDetail = () => import("@/components/NodeDetail").then((m) => ({ default: m.NodeDetail }))
const NodeDetail = lazy(loadDetail)

function useNodeRoute() {
  const read = () => {
    const match = location.pathname.match(/^\/node\/(\d+)/)
    return match ? Number(match[1]) : null
  }
  const [id, setId] = useState(read)
  useEffect(() => {
    const sync = () => setId(read())
    addEventListener("popstate", sync)
    return () => removeEventListener("popstate", sync)
  }, [])
  return [
    id,
    (next: number | null) => {
      history.pushState({}, "", next === null ? "/" : `/node/${next}`)
      setId(next)
      scrollTo(0, 0)
    },
  ] as const
}

const DARK_MEDIA = matchMedia("(prefers-color-scheme: dark)")

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("theme_mode")
    if (saved === "light" || saved === "dark" || saved === "system") return saved
    return "system"
  })

  const systemDark = useSyncExternalStore(
    (notify) => {
      DARK_MEDIA.addEventListener("change", notify)
      return () => DARK_MEDIA.removeEventListener("change", notify)
    },
    () => DARK_MEDIA.matches
  )

  const isDark = mode === "system" ? systemDark : mode === "dark"

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  const setThemeMode = useCallback((next: ThemeMode, persist = true) => {
    setMode(next)
    if (persist) {
      if (next === "system") {
        localStorage.removeItem("theme_mode")
        localStorage.removeItem("theme")
      } else {
        localStorage.setItem("theme_mode", next)
      }
    }
  }, [])

  return { mode, setThemeMode }
}

function useCustomBackground() {
  const [bgUrl, setBgUrl] = useState(() => {
    const saved = localStorage.getItem("theme_custom_bg")
    if (saved === "none") return ""
    return saved || ""
  })
  const [bgMask, setBgMask] = useState(() => {
    const saved = localStorage.getItem("theme_bg_mask")
    return saved !== null ? Number(saved) : 35
  })

  const updateBgUrl = useCallback((url: string, persist = true) => {
    setBgUrl(url)
    if (persist) {
      if (url) {
        localStorage.setItem("theme_custom_bg", url)
      } else {
        localStorage.setItem("theme_custom_bg", "none")
      }
    }
  }, [])

  const updateBgMask = useCallback((val: number, persist = true) => {
    setBgMask(val)
    if (persist) {
      localStorage.setItem("theme_bg_mask", String(val))
    }
  }, [])

  return { bgUrl, bgMask, updateBgUrl, updateBgMask }
}

function useCardStyle() {
  const [cardStyle, setCardStyle] = useState<CardStyle>(() => {
    const saved = localStorage.getItem("theme_card_style")
    if (saved === "blur" || saved === "solid" || saved === "transparent") {
      return saved
    }
    const legacyBlur = localStorage.getItem("theme_card_blur")
    if (legacyBlur === "true") return "blur"
    return "solid"
  })

  useEffect(() => {
    document.documentElement.setAttribute("data-card-style", cardStyle)
    document.documentElement.setAttribute("data-card-blur", String(cardStyle !== "solid"))
  }, [cardStyle])

  const updateCardStyle = useCallback((style: CardStyle, persist = true) => {
    setCardStyle(style)
    if (persist) {
      localStorage.setItem("theme_card_style", style)
      localStorage.setItem("theme_card_blur", String(style !== "solid"))
    }
  }, [])

  return { cardStyle, updateCardStyle }
}

const PALETTES: { key: Palette; name: string; color: string }[] = [
  { key: "mono", name: "极简白", color: "#ffffff" },
  { key: "ocean", name: "天空蓝", color: "#38bdf8" },
  { key: "emerald", name: "薄荷绿", color: "#34d399" },
  { key: "iris", name: "浅紫色", color: "#a78bfa" },
  { key: "sunset", name: "暖阳金", color: "#fbbf24" },
]

function usePalette(defaultPalette: Palette = "mono") {
  const [current, setCurrent] = useState<Palette>(() => {
    return (localStorage.getItem("theme_palette") as Palette) || defaultPalette || "mono"
  })

  useEffect(() => {
    document.documentElement.setAttribute("data-palette", current)
  }, [current])

  const set = useCallback((palette: Palette, persist = true) => {
    setCurrent(palette)
    if (persist) {
      if (palette === "mono") {
        localStorage.removeItem("theme_palette")
      } else {
        localStorage.setItem("theme_palette", palette)
      }
    }
  }, [])

  return [current, set] as const
}

export default function App() {
  const { mode: themeMode, setThemeMode } = useTheme()
  const { bgUrl, bgMask, updateBgUrl, updateBgMask } = useCustomBackground()
  const { cardStyle, updateCardStyle } = useCardStyle()
  const [config, setConfig] = useState<ThemeConfig | null>(null)
  const [palette, setPalette] = usePalette(config?.palette ?? "mono")

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("theme_view_mode") as ViewMode) || "list"
  })
  const updateViewMode = useCallback((mode: ViewMode, persist = true) => {
    setViewMode(mode)
    if (persist) localStorage.setItem("theme_view_mode", mode)
  }, [])

  const [colCount, setColCount] = useState<number>(() => {
    const saved = localStorage.getItem("theme_columns")
    return saved ? Number(saved) : 3
  })
  const updateColCount = useCallback((c: number, persist = true) => {
    setColCount(c)
    if (persist) localStorage.setItem("theme_columns", String(c))
  }, [])

  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme_summary_collapsed")
    if (saved !== null) return saved === "true"
    return true
  })
  const updateSummaryCollapsed = useCallback((collapsed: boolean, persist = true) => {
    setSummaryCollapsed(collapsed)
    if (persist) localStorage.setItem("theme_summary_collapsed", String(collapsed))
  }, [])

  const [showSparkline, setShowSparkline] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme_show_sparkline")
    if (saved !== null) return saved === "true"
    return true
  })
  const updateShowSparkline = useCallback((show: boolean, persist = true) => {
    setShowSparkline(show)
    if (persist) localStorage.setItem("theme_show_sparkline", String(show))
  }, [])

  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState("")
  const { nodes, error, closed } = useNodes()
  const [open, go] = useNodeRoute()
  const [group, setGroup] = useState<string | null>(null)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  // Dynamically synchronize card style, blur & opacity to CSS variables
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute("data-card-style", cardStyle)
    root.setAttribute("data-card-blur", String(cardStyle !== "solid"))

    if (cardStyle === "solid") {
      root.style.setProperty("--glass-blur", "0px")
      root.style.setProperty("--glass-bg-opacity", "1")
      root.style.setProperty("--pill-bg-opacity", "1")
    } else if (cardStyle === "transparent") {
      const px = Math.round(10 + (bgMask / 100) * 16)
      const op = (0.55 + (bgMask / 100) * 0.25).toFixed(2)
      root.style.setProperty("--glass-blur", `${px}px`)
      root.style.setProperty("--glass-bg-opacity", op)
      root.style.setProperty("--pill-bg-opacity", (0.50 + (bgMask / 100) * 0.25).toFixed(2))
    } else {
      // "blur" mode: frosted glass with 0-100 stepless control
      const px = Math.round((bgMask / 100) * 36)
      const op = bgMask === 0 ? "1" : (0.65 + (bgMask / 100) * 0.30).toFixed(2)
      root.style.setProperty("--glass-blur", `${px}px`)
      root.style.setProperty("--glass-bg-opacity", op)
      root.style.setProperty("--pill-bg-opacity", (0.50 + (bgMask / 100) * 0.35).toFixed(2))
    }
  }, [cardStyle, bgMask])

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg)
      if (localStorage.getItem("theme_palette") === null && cfg.palette) {
        setPalette(cfg.palette, false)
      }
      if (localStorage.getItem("theme_mode") === null && cfg.theme_mode) {
        setThemeMode(cfg.theme_mode, false)
      }
      if (localStorage.getItem("theme_card_style") === null && cfg.card_style) {
        updateCardStyle(cfg.card_style, false)
      }
      if (localStorage.getItem("theme_custom_bg") === null && cfg.bg_url !== undefined) {
        updateBgUrl(cfg.bg_url, false)
      }
      if (localStorage.getItem("theme_bg_mask") === null && cfg.bg_mask !== undefined) {
        updateBgMask(cfg.bg_mask, false)
      }
      if (localStorage.getItem("theme_view_mode") === null && cfg.default_view) {
        updateViewMode(cfg.default_view, false)
      }
      if (localStorage.getItem("theme_columns") === null && cfg.columns) {
        updateColCount(cfg.columns, false)
      }
      if (localStorage.getItem("theme_summary_collapsed") === null && cfg.show_summary !== undefined) {
        updateSummaryCollapsed(!cfg.show_summary, false)
      }
      if (localStorage.getItem("theme_show_sparkline") === null && cfg.show_sparkline !== undefined) {
        updateShowSparkline(cfg.show_sparkline !== false, false)
      }
    })
  }, [
    setPalette,
    setThemeMode,
    updateCardStyle,
    updateBgUrl,
    updateBgMask,
    updateViewMode,
    updateColCount,
    updateSummaryCollapsed,
    updateShowSparkline,
  ])

  const handleResetPreferences = useCallback(() => {
    localStorage.removeItem("theme_mode")
    localStorage.removeItem("theme")
    localStorage.removeItem("theme_custom_bg")
    localStorage.removeItem("theme_bg_mask")
    localStorage.removeItem("theme_card_style")
    localStorage.removeItem("theme_card_blur")
    localStorage.removeItem("theme_palette")
    localStorage.removeItem("theme_view_mode")
    localStorage.removeItem("theme_columns")
    localStorage.removeItem("theme_summary_collapsed")
    localStorage.removeItem("theme_show_sparkline")

    const defPalette = config?.palette ?? "mono"
    const defMode = config?.theme_mode ?? "system"
    const defStyle = config?.card_style ?? "solid"
    const defBgUrl = config?.bg_url ?? ""
    const defMask = config?.bg_mask ?? 35
    const defView = config?.default_view ?? "list"
    const defCols = config?.columns ?? 3
    const defSummary = config?.show_summary !== undefined ? !config.show_summary : true
    const defSpark = config?.show_sparkline !== undefined ? config.show_sparkline !== false : true

    setPalette(defPalette, false)
    setThemeMode(defMode, false)
    updateCardStyle(defStyle, false)
    updateBgUrl(defBgUrl, false)
    updateBgMask(defMask, false)
    updateViewMode(defView, false)
    updateColCount(defCols, false)
    updateSummaryCollapsed(defSummary, false)
    updateShowSparkline(defSpark, false)
  }, [
    config,
    setPalette,
    setThemeMode,
    updateCardStyle,
    updateBgUrl,
    updateBgMask,
    updateViewMode,
    updateColCount,
    updateSummaryCollapsed,
    updateShowSparkline,
  ])

  const loadMe = useCallback(() => {
    return api<Me>("/me")
      .then((next) => {
        setMe(next)
        setMeError("")
      })
      .catch((e: Error) => setMeError(e.message || "网络异常"))
  }, [])

  useEffect(() => {
    loadMe()
    // Preload heavy detail chunk during idle time instead of competing with critical initial load
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void loadDetail())
    } else {
      setTimeout(() => void loadDetail(), 2000)
    }
  }, [loadMe])

  useEffect(() => {
    if (closed) void loadMe()
  }, [closed, loadMe])

  useEffect(() => {
    if (me && !me.public_page && !me.authed) location.href = "/admin/"
  }, [me])

  const sorted = useMemo(() => {
    return [...(nodes ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id)
  }, [nodes])

  const regionCount = useMemo(() => {
    return new Set(sorted.map((n) => n.country?.toUpperCase()).filter(Boolean)).size
  }, [sorted])

  const selected = sorted.find((n) => n.id === open)

  useEffect(() => {
    document.title = [selected?.name, me?.site_name || "Guga"].filter(Boolean).join(" · ")
  }, [selected?.name, me?.site_name])

  if (!me) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">
        {meError ? (
          <div className="space-y-4 text-center">
            <p className="rounded-full bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive">
              加载状态失败：{meError}
            </p>
            <button
              onClick={loadMe}
              className="rounded-full bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs font-medium">正在建立节点数据通道…</span>
          </div>
        )}
      </div>
    )
  }

  if (!me.public_page && !me.authed) return null

  return (
    <div className={cn("min-h-svh text-foreground pb-20 relative", !bgUrl && "bg-background")}>
      {/* iOS Style Frosted Glass Wallpaper Layer */}
      {bgUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          style={{ transform: "translateZ(0)" }}
        >
          {/* iOS Wallpaper with natural soft focus depth */}
          <img
            src={bgUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute -inset-6 size-[calc(100%+3rem)] max-w-none object-cover object-center"
            style={{
              filter: bgMask === 0 ? "none" : `blur(${((bgMask / 100) * 16).toFixed(1)}px) saturate(1.15)`,
              transform: "scale(1.05)",
            }}
          />
          {/* iOS Frosted Glass Translucent Scrim */}
          {bgMask > 0 && (
            <div
              className="absolute inset-0 bg-white/40 dark:bg-black/50 backdrop-blur-xl transition-opacity duration-200"
              style={{ opacity: bgMask / 100 }}
            />
          )}
        </div>
      )}
      {/* World Map Modal Dialog */}
      <WorldMap
        nodes={sorted}
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        isModal
      />

      <main
        className={cn(
          "relative z-10 mx-auto space-y-5 px-3 sm:px-6 pt-4 sm:pt-6 transition-[max-width] duration-200",
          colCount >= 5 ? "max-w-[1720px]" : colCount === 4 ? "max-w-[1480px]" : "max-w-[1340px]"
        )}
      >
        {/* Notice Banner - only display if notice has actual text, never show empty banner */}
        {config?.notice?.trim() ? (
          <div className="flex items-center gap-2.5 rounded-full bg-primary/10 border border-primary/25 px-5 py-2.5 text-xs font-semibold text-foreground backdrop-blur-xl shadow-2xs">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span className="truncate">{config.notice.trim()}</span>
          </div>
        ) : null}

        {/* Global error banner only if initial fetch failed and there are no nodes */}
        {!nodes && error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        {open !== null ? (
          !nodes ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : selected ? (
            <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
              <NodeDetail node={selected} />
            </Suspense>
          ) : (
            <div className="py-20 text-center text-sm text-muted-foreground space-y-3">
              <p>节点不存在或当前尚未公开展示</p>
              <button
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
                onClick={() => go(null)}
              >
                返回节点列表
              </button>
            </div>
          )
        ) : !nodes ? (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : (
          <NodeList
            nodes={sorted}
            group={group}
            onGroup={setGroup}
            onOpen={go}
            viewMode={viewMode}
            onViewModeChange={updateViewMode}
            colCount={colCount}
            onColCountChange={updateColCount}
            summaryCollapsed={summaryCollapsed}
            onToggleSummary={() => updateSummaryCollapsed(!summaryCollapsed)}
            showSparkline={showSparkline}
            siteName={me?.site_name || "Guga"}
          />
        )}
      </main>

      {/* Right-Bottom Expandable Speed-Dial Action Group */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5 select-none pointer-events-none">
        {/* Click-outside Backdrop Scrim - Zero blur overhead, pure GPU alpha opacity */}
        <div
          className={cn(
            "fixed inset-0 z-30 bg-black/25 dark:bg-black/45 transition-opacity duration-200 pointer-events-auto",
            fabOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setFabOpen(false)}
        />

        {/* Speed-Dial Menu Items - Hardware accelerated transform/opacity transition */}
        <div
          className={cn(
            "relative z-40 flex flex-col items-end gap-2 transition-[transform,opacity] duration-200 ease-out origin-bottom-right",
            fabOpen
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-3 scale-95 pointer-events-none"
          )}
          style={{ willChange: "transform, opacity" }}
        >
          {/* 1. World Map Action */}
          <button
            onClick={() => {
              setFabOpen(false)
              setMapModalOpen(true)
            }}
            className="flex items-center gap-2.5 rounded-full bg-card border border-border/60 py-2 px-3.5 shadow-lg hover:border-primary/50 hover:scale-102 transition-transform duration-150 cursor-pointer active:scale-95 text-foreground group"
            title="查看节点分布世界地图"
          >
            <span className="text-xs font-medium">节点地图</span>
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Globe className="size-3.5" />
            </div>
            {regionCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                {regionCount}
              </span>
            )}
          </button>

          {/* 2. Control Panel / Login Link */}
          <a
            href="/admin/"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2.5 rounded-full bg-card border border-border/60 py-2 px-3.5 shadow-lg hover:border-primary/50 hover:scale-102 transition-transform duration-150 active:scale-95 text-foreground group"
            title={me.authed ? "进入控制面板" : "登录"}
          >
            <span className="text-xs font-medium">{me.authed ? "控制面板" : "登录"}</span>
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <Wrench className="size-3.5" />
            </div>
          </a>

          {/* 3. Settings Action */}
          <button
            onClick={() => {
              setFabOpen(false)
              setSettingsOpen(true)
            }}
            className="flex items-center gap-2.5 rounded-full bg-card border border-border/60 py-2 px-3.5 shadow-lg hover:border-primary/50 hover:scale-102 transition-transform duration-150 cursor-pointer active:scale-95 text-foreground group"
            title="个性化与偏好设置"
          >
            <span className="text-xs font-medium">偏好设置</span>
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-105 transition-transform">
              <SlidersHorizontal className="size-3.5" />
            </div>
          </button>
        </div>

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className={cn(
            "relative z-40 flex size-12 items-center justify-center rounded-full border shadow-lg transition-[transform,background-color,border-color] duration-200 ease-out cursor-pointer active:scale-95 pointer-events-auto bg-card",
            fabOpen
              ? "!bg-primary text-primary-foreground !border-primary shadow-xl rotate-90"
              : "text-foreground border-border/60 hover:border-primary/50 hover:shadow-xl hover:scale-105"
          )}
          style={{ willChange: "transform" }}
          title={fabOpen ? "收起快捷菜单" : "快捷操作 (地图、面板、设置)"}
          aria-label={fabOpen ? "收起快捷菜单" : "快捷操作 (地图、面板、设置)"}
        >
          {fabOpen ? (
            <X className="size-5 transition-transform duration-200" />
          ) : (
            <SlidersHorizontal className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        palette={palette}
        onPaletteChange={setPalette}
        palettes={PALETTES}
        cardStyle={cardStyle}
        onCardStyleChange={updateCardStyle}
        bgUrl={bgUrl}
        onBgUrlChange={updateBgUrl}
        bgMask={bgMask}
        onBgMaskChange={updateBgMask}
        viewMode={viewMode}
        onViewModeChange={updateViewMode}
        colCount={colCount}
        onColCountChange={updateColCount}
        summaryCollapsed={summaryCollapsed}
        onSummaryCollapsedChange={updateSummaryCollapsed}
        showSparkline={showSparkline}
        onShowSparklineChange={updateShowSparkline}
        onResetAll={handleResetPreferences}
      />
    </div>
  )
}

type QuickFilter = "all" | "online" | "high_load" | "expiring"

function NodeList({
  nodes,
  group,
  onGroup,
  onOpen,
  viewMode,
  onViewModeChange,
  colCount,
  onColCountChange,
  summaryCollapsed,
  onToggleSummary,
  showSparkline = true,
  siteName,
}: {
  nodes: Node[]
  group: string | null
  onGroup: (group: string | null) => void
  onOpen: (id: number) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  colCount: number
  onColCountChange: (cols: number) => void
  summaryCollapsed: boolean
  onToggleSummary: () => void
  showSparkline?: boolean
  siteName?: string
}) {
  const [query, setQuery] = useState("")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")

  const groups = groupsOf(nodes)
  const ungrouped = nodes.filter((n) => !n.group).length

  const current = group === null || (group === "" ? ungrouped > 0 : groups.includes(group)) ? group : null
  useEffect(() => {
    if (current !== group) onGroup(current)
  }, [current, group, onGroup])

  const groupFiltered = current === null ? nodes : nodes.filter((n) => (n.group ?? "") === current)

  const quickFiltered = useMemo(() => {
    switch (quickFilter) {
      case "online":
        return groupFiltered.filter((n) => n.online)
      case "high_load":
        return groupFiltered.filter((n) => (n.metrics?.cpu ?? 0) >= 40)
      case "expiring":
        return groupFiltered.filter((n) => {
          const d = n.expires_in !== undefined ? n.expires_in : null
          return d !== null && d <= 60
        })
      default:
        return groupFiltered
    }
  }, [groupFiltered, quickFilter])

  const searchFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return quickFiltered
    return quickFiltered.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.os && n.os.toLowerCase().includes(q)) ||
        (n.country && n.country.toLowerCase().includes(q)) ||
        (n.arch && n.arch.toLowerCase().includes(q)) ||
        (n.virt && n.virt.toLowerCase().includes(q)) ||
        (n.hostname && n.hostname.toLowerCase().includes(q)) ||
        (n.ip && n.ip.toLowerCase().includes(q))
    )
  }, [quickFiltered, query])

  const onlineCount = nodes.filter((n) => n.online).length
  const highLoadCount = nodes.filter((n) => (n.metrics?.cpu ?? 0) >= 40).length
  const expiringCount = nodes.filter((n) => {
    const d = n.expires_in !== undefined ? n.expires_in : null
    return d !== null && d <= 60
  }).length

  const tabs = [
    [null, "全部", nodes.length] as const,
    ...groups.map((g) => [g, g, nodes.filter((n) => n.group === g).length] as const),
    ...(ungrouped ? [["", "未分组", ungrouped] as const] : []),
  ]

  const gridClass =
    colCount === 1
      ? "grid-cols-1"
      : colCount === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : colCount === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : colCount === 5
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1180px]:grid-cols-5"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div className="space-y-4">
      {/* Quick Settings Style Summary Tiles */}
      <Summary
        nodes={groupFiltered}
        group={current}
        collapsed={summaryCollapsed}
        siteName={siteName}
      />

      {/* Unified Compact Toolbar */}
      <div className="space-y-3 pt-1">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* 1. Google-style Search Pill */}
          <div className="relative flex-1 min-w-[200px] max-w-lg">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex size-4 items-center justify-center text-muted-foreground pointer-events-none">
              <Search className="size-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索节点、IP、系统、区域…"
              className="glass-card h-10 w-full rounded-full border border-border/50 py-2 pl-10 pr-9 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 shadow-2xs transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* 2. Controls: Filter Chips + Column Switcher + View Switcher */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            {/* Status Segmented Control */}
            <div className="pill-bar inline-flex h-10 items-center rounded-full bg-muted/60 p-1 border border-border/40 shrink-0 select-none gap-1">
              <button
                onClick={() => setQuickFilter("all")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer",
                  quickFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>全部</span>
                <span className="tnum text-[11px] opacity-75">
                  {query ? searchFiltered.length : groupFiltered.length}
                </span>
              </button>

              <button
                onClick={() => setQuickFilter("online")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer",
                  quickFilter === "online"
                    ? "bg-ok text-white shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                <span>在线</span>
                <span className="tnum text-[11px] opacity-80">{onlineCount}</span>
              </button>

              {highLoadCount > 0 && (
                <button
                  onClick={() => setQuickFilter("high_load")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer",
                    quickFilter === "high_load"
                      ? "bg-warn text-zinc-950 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Flame className="size-3.5" />
                  <span className="hidden sm:inline">高负载</span>
                  <span className="tnum text-[11px]">({highLoadCount})</span>
                </button>
              )}

              {expiringCount > 0 && (
                <button
                  onClick={() => setQuickFilter("expiring")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer",
                    quickFilter === "expiring"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Hourglass className="size-3.5" />
                  <span className="hidden sm:inline">快到期</span>
                  <span className="tnum text-[11px]">({expiringCount})</span>
                </button>
              )}
            </div>

            {/* Column Switcher (Grid or Compact, Tablet/Desktop only) */}
            {viewMode !== "list" && (
              <div className="pill-bar hidden md:inline-flex h-10 items-center rounded-full bg-muted/60 p-1 border border-border/40 shrink-0 select-none gap-0.5">
                {[2, 3, 4, 5].map((c) => (
                  <button
                    key={c}
                    onClick={() => onColCountChange(c)}
                    className={cn(
                      "flex h-8 min-w-[32px] items-center justify-center rounded-full px-2 text-xs font-medium transition-all cursor-pointer",
                      colCount === c
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title={`${c}列显示`}
                  >
                    {c}列
                  </button>
                ))}
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="pill-bar inline-flex h-10 items-center rounded-full bg-muted/60 p-1 border border-border/40 shrink-0 select-none gap-0.5">
              <button
                onClick={() => onViewModeChange("grid")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="网格视图"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline text-xs">网格</span>
              </button>

              <button
                onClick={() => onViewModeChange("compact")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "compact"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="紧凑视图"
              >
                <Grid3X3 className="size-3.5" />
                <span className="hidden sm:inline text-xs">紧凑</span>
              </button>

              <button
                onClick={() => onViewModeChange("list")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs font-medium transition-all cursor-pointer",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="列表视图"
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline text-xs">列表</span>
              </button>
            </div>

            {/* Summary Collapsible Toggle Button */}
            <button
              onClick={onToggleSummary}
              className={cn(
                "pill-bar inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all cursor-pointer border border-border/40 select-none shrink-0 active:scale-95",
                summaryCollapsed
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-primary font-semibold"
              )}
              title={summaryCollapsed ? "展开顶部监控看板" : "收起顶部监控看板"}
            >
              <BarChart2 className="size-3.5" />
              <span className="hidden sm:inline text-xs">看板</span>
              {summaryCollapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
            </button>
          </div>
        </div>

        {/* Group Tabs (rendered neatly only when groups exist) */}
        {groups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none pt-0.5 select-none">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1 shrink-0">
              <SlidersHorizontal className="size-3.5" /> 分组:
            </span>
            {tabs.map(([value, label, count]) => {
              const active = current === value
              return (
                <button
                  key={value === null ? "*" : `=${value}`}
                  onClick={() => onGroup(value)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "glass-card text-muted-foreground hover:text-foreground border border-border/40"
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      "tnum text-[11px] rounded-full px-1.5 py-0.2",
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Node Content Area */}
      {searchFiltered.length === 0 ? (
        <div className="glass-card rounded-2xl border border-border/50 p-12 text-center text-xs text-muted-foreground">
          未检索到匹配的巡检节点，请尝试清空筛选条件。
        </div>
      ) : viewMode === "list" ? (
        <div className="flex flex-col gap-2.5">
          {searchFiltered.map((n) => (
            <NodeListRow key={n.id} node={n} onOpen={() => onOpen(n.id)} />
          ))}
        </div>
      ) : viewMode === "compact" ? (
        <div className={cn("grid gap-3 items-stretch", gridClass)}>
          {searchFiltered.map((n) => (
            <NodeCompactCard key={n.id} node={n} onOpen={() => onOpen(n.id)} />
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-4 items-stretch", gridClass)}>
          {searchFiltered.map((n) => (
            <NodeCard key={n.id} node={n} onOpen={() => onOpen(n.id)} showSparkline={showSparkline} />
          ))}
        </div>
      )}
    </div>
  )
}
