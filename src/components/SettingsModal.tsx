import { useState, type ReactNode } from "react"
import {
  X,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  Palette as PaletteIcon,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Layers,
  Sparkles,
  Square,
  Droplets,
  Shield,
  Save,
  RefreshCw,
} from "lucide-react"
import type { Palette } from "@/lib/config"
import { cn } from "@/lib/utils"

export type ThemeMode = "system" | "light" | "dark"
export type CardStyle = "blur" | "solid" | "transparent"
export type ViewMode = "grid" | "compact" | "list"

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  monochrome: boolean
  onMonochromeChange: (val: boolean) => void
  palette: Palette
  onPaletteChange: (palette: Palette) => void
  palettes: { key: Palette; name: string; color: string }[]
  cardStyle: CardStyle
  onCardStyleChange: (style: CardStyle) => void
  cardBlur: number
  onCardBlurChange: (val: number) => void
  bgUrl: string
  defaultBgUrl?: string
  onBgUrlChange: (url: string) => void
  bgBlur: number
  onBgBlurChange: (val: number) => void
  bgMask: number
  onBgMaskChange: (val: number) => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  colCount?: number
  onColCountChange?: (cols: number) => void
  summaryCollapsed: boolean
  onSummaryCollapsedChange: (collapsed: boolean) => void
  toolbarExpanded?: boolean
  onToolbarExpandedChange?: (expanded: boolean) => void
  showSparkline: boolean
  onShowSparklineChange: (show: boolean) => void
  showMap: boolean
  onShowMapChange: (show: boolean) => void
  onResetAll: () => void
  isAuthed?: boolean
  onSaveSiteDefaults?: () => Promise<void>
}

const PRESET_WALLPAPERS = [
  {
    name: "必应每日壁纸",
    url: "https://api.kdcc.cn/img/bing.php",
  },
  {
    name: "必应随机壁纸",
    url: "https://bing.ee123.net/img/rand",
  },
]

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof SlidersHorizontal
  title: string
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Icon className="size-3.5 text-primary" />
        <span>{title}</span>
      </div>
      <div className="rounded-2xl border border-border/40 bg-muted/30 p-3.5 space-y-3.5">
        {children}
      </div>
    </div>
  )
}

export function SettingsModal({
  isOpen,
  onClose,
  themeMode,
  onThemeModeChange,
  monochrome = false,
  onMonochromeChange,
  palette,
  onPaletteChange,
  palettes,
  cardStyle,
  onCardStyleChange,
  cardBlur = 40,
  onCardBlurChange,
  bgUrl,
  defaultBgUrl,
  onBgUrlChange,
  bgBlur = 20,
  onBgBlurChange,
  bgMask = 35,
  onBgMaskChange,
  summaryCollapsed,
  onSummaryCollapsedChange,
  toolbarExpanded = true,
  onToolbarExpandedChange,
  showSparkline,
  onShowSparklineChange,
  showMap = false,
  onShowMapChange,
  onResetAll,
  isAuthed = false,
  onSaveSiteDefaults,
}: SettingsModalProps) {
  const [inputUrl, setInputUrl] = useState(bgUrl)
  const [prevBgUrl, setPrevBgUrl] = useState(bgUrl)
  if (bgUrl !== prevBgUrl) {
    setPrevBgUrl(bgUrl)
    setInputUrl(bgUrl)
  }
  const [resetFeedback, setResetFeedback] = useState(false)
  const [isSavingSite, setIsSavingSite] = useState(false)
  const [siteSaveSuccess, setSiteSaveSuccess] = useState(false)
  const [siteSaveError, setSiteSaveError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleApplyUrl = () => {
    onBgUrlChange(inputUrl.trim())
  }

  const handleSelectPreset = (url: string) => {
    setInputUrl(url)
    onBgUrlChange(url)
  }

  const handleClearWallpaper = () => {
    setInputUrl("")
    onBgUrlChange("")
  }

  const handleReset = () => {
    onResetAll()
    setInputUrl(defaultBgUrl ?? "")
    setResetFeedback(true)
    setTimeout(() => setResetFeedback(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      {/* Backdrop Scrim - Lightweight high contrast, zero GPU blur */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 transition-opacity duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog / Mobile Bottom Sheet (Opaque container with sleek styling, zero nested blurs for 60fps) */}
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight">个性化设置</h3>
              <p className="text-[11px] text-muted-foreground font-normal">设置当前设备的外观偏好（仅本地浏览器生效）</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer active:scale-95"
            title="关闭设置"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content Body with Custom Sleek Scrollbar */}
        <div className="custom-scrollbar overflow-y-auto px-5 py-4 space-y-5">

          {/* 1. 外观与模式 (深浅色自适应) */}
          <Section icon={Sun} title="外观模式">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onThemeModeChange("system")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95",
                  themeMode === "system"
                    ? "bg-primary/15 text-foreground border-primary shadow-2xs font-semibold ring-1 ring-primary/30"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
                )}
                title="外观模式：跟随操作系统与浏览器深浅主题自动无缝切换"
              >
                <Monitor className="size-4" />
                <span>跟随系统</span>
              </button>

              <button
                type="button"
                onClick={() => onThemeModeChange("light")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95",
                  themeMode === "light"
                    ? "bg-primary/15 text-foreground border-primary shadow-2xs font-semibold ring-1 ring-primary/30"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
                )}
                title="外观模式：强制使用明亮浅色主题"
              >
                <Sun className="size-4" />
                <span>浅色模式</span>
              </button>

              <button
                type="button"
                onClick={() => onThemeModeChange("dark")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95",
                  themeMode === "dark"
                    ? "bg-primary/15 text-foreground border-primary shadow-2xs font-semibold ring-1 ring-primary/30"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
                )}
                title="外观模式：强制使用沉浸深色主题"
              >
                <Moon className="size-4" />
                <span>深色模式</span>
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground font-normal leading-relaxed">
              选择「跟随系统」时，将随您的操作系统或浏览器深浅主题自动无缝切换。
            </p>

            {/* 纯黑白极简字色开关 */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/50">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">纯黑白极简字色</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-medium transition-colors",
                      monochrome
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {monochrome ? "已开启" : "已关闭"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  去除速率与指标彩色，转为纯黑白灰度，极致精简不臃肿
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={monochrome}
                onClick={() => onMonochromeChange(!monochrome)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5",
                  monochrome
                    ? "bg-primary/15 border-primary text-primary shadow-2xs"
                    : "bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                )}
                title={monochrome ? "纯黑白字色：当前已开启（点击切换关闭）" : "纯黑白字色：当前已关闭（点击切换开启）"}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full transition-all",
                    monochrome ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/60"
                  )}
                />
                <span>{monochrome ? "已开启" : "已关闭"}</span>
              </button>
            </div>
          </Section>

          {/* 2. 主题配色 */}
          <Section icon={PaletteIcon} title="主题配色">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {palettes.map((p) => {
                const isActive = palette === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onPaletteChange(p.key)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer active:scale-95",
                      isActive
                        ? "bg-primary/10 border-primary shadow-2xs font-semibold text-foreground"
                        : "bg-card hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    <span
                      className="size-3.5 rounded-full shrink-0 border border-black/10 dark:border-white/20 shadow-xs"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs truncate">{p.name}</span>
                    {isActive && <Check className="size-3 text-primary ml-auto shrink-0" />}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* 3. 卡片样式 (纯色 vs 透明 vs 毛玻璃) */}
          <Section icon={Layers} title="卡片样式">
            <div className="grid grid-cols-3 gap-2">
              {/* 1. 纯色卡片 (默认) */}
              <button
                type="button"
                onClick={() => onCardStyleChange("solid")}
                className={cn(
                  "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95",
                  cardStyle === "solid"
                    ? "bg-primary/10 border-primary text-foreground font-semibold shadow-2xs"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50 font-medium"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Square className="size-3.5 fill-foreground text-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">纯色卡片</span>
                  </div>
                  {cardStyle === "solid" && <Check className="size-3 text-primary shrink-0" />}
                </div>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal leading-tight line-clamp-2">
                  默认纯色，无模糊
                </span>
              </button>

              {/* 2. 透明卡片 */}
              <button
                type="button"
                onClick={() => onCardStyleChange("transparent")}
                className={cn(
                  "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95",
                  cardStyle === "transparent"
                    ? "bg-primary/10 border-primary text-foreground font-semibold shadow-2xs"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50 font-medium"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="size-3.5 text-sky-400 shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">玻璃</span>
                  </div>
                  {cardStyle === "transparent" && <Check className="size-3 text-primary shrink-0" />}
                </div>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal leading-tight line-clamp-2">
                  晶莹透光玻璃
                </span>
              </button>

              {/* 3. 毛玻璃卡片 */}
              <button
                type="button"
                onClick={() => onCardStyleChange("blur")}
                className={cn(
                  "flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-95",
                  cardStyle === "blur"
                    ? "bg-primary/10 border-primary text-foreground font-semibold shadow-2xs"
                    : "bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border/50 font-medium"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Droplets className="size-3.5 text-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">毛玻璃卡片</span>
                  </div>
                  {cardStyle === "blur" && <Check className="size-3 text-primary shrink-0" />}
                </div>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal leading-tight line-clamp-2">
                  半透明磨砂质感
                </span>
              </button>
            </div>

            {/* Stepless Card Blur Controls (Active in blur or transparent mode) */}
            {cardStyle !== "solid" && (
              <div className="space-y-3 pt-2.5 border-t border-border/30">
                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span>卡片毛玻璃模糊度 (0-100%)</span>
                  <span className="tnum font-semibold text-primary">{cardBlur}%</span>
                </div>

                {/* Stepless Range Slider & Number Input */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={cardBlur}
                    onChange={(e) => onCardBlurChange(Number(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
                  />
                  <div className="relative w-16 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cardBlur}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value)
                        onCardBlurChange(Math.max(0, Math.min(100, Math.round(val))))
                      }}
                      className="w-full rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground text-center focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs pr-5"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { val: 0, label: "0% 纯通透 (无模糊)" },
                    { val: 20, label: "20% 轻度" },
                    { val: 40, label: "40% 标准 (推荐)" },
                    { val: 70, label: "70% 深度" },
                    { val: 100, label: "100% 极深" },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onCardBlurChange(val)}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer active:scale-95",
                        cardBlur === val
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                          : "bg-card hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-muted-foreground font-normal leading-relaxed">
                  独立调节信息卡片的毛玻璃模糊强度，不影响背景壁纸。
                </p>
              </div>
            )}
          </Section>

          {/* 4. 背景壁纸 */}
          <Section icon={ImageIcon} title="背景壁纸">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="输入壁纸图片链接 (https://...)"
                  className="flex-1 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs font-normal"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  应用
                </button>
                {bgUrl && (
                  <button
                    type="button"
                    onClick={handleClearWallpaper}
                    className="rounded-xl border border-border/60 bg-card hover:bg-muted px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    title="清除当前壁纸"
                  >
                    清除
                  </button>
                )}
              </div>

              {/* Presets with dedicated "No Wallpaper" button */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="text-[11px] text-muted-foreground shrink-0 font-medium">快速切换:</span>

                {/* Explicit Clear / No Wallpaper Option */}
                <button
                  type="button"
                  onClick={handleClearWallpaper}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer active:scale-95",
                    !bgUrl
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-card hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  🚫 无壁纸 (默认纯色)
                </button>

                {/* Bing Daily and Random Presets */}
                {PRESET_WALLPAPERS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-colors cursor-pointer active:scale-95",
                      bgUrl === preset.url
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "bg-card hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Wallpaper Blur & Mask (Active when wallpaper is set) */}
              {bgUrl && (
                <div className="space-y-3 pt-2.5 border-t border-border/30">
                  {/* 1. Wallpaper Blur Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-foreground">
                      <span>背景壁纸虚化度 (0-100%)</span>
                      <span className="tnum font-semibold text-primary">{bgBlur}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={bgBlur}
                        onChange={(e) => onBgBlurChange(Number(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
                      />
                      <div className="relative w-16 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={bgBlur}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value)
                            onBgBlurChange(Math.max(0, Math.min(100, Math.round(val))))
                          }}
                          className="w-full rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground text-center focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs pr-5"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-normal leading-relaxed">
                      调节壁纸本身的虚化模糊程度，与卡片毛玻璃相互独立。
                    </p>
                  </div>

                  {/* 2. Wallpaper Mask/Dimming Slider */}
                  <div className="space-y-1.5 pt-2 border-t border-border/20">
                    <div className="flex items-center justify-between text-xs font-medium text-foreground">
                      <span>背景遮罩浓度 (0-100%)</span>
                      <span className="tnum font-semibold text-primary">{bgMask}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={bgMask}
                        onChange={(e) => onBgMaskChange(Number(e.target.value))}
                        className="flex-1 h-2 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
                      />
                      <div className="relative w-16 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={bgMask}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value)
                            onBgMaskChange(Math.max(0, Math.min(100, Math.round(val))))
                          }}
                          className="w-full rounded-xl border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground text-center focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs pr-5"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-normal leading-relaxed">
                      调节壁纸上方深浅色保护遮罩，数值越大越容易看清文字。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 5. 看板与图表功能 */}
          <Section icon={Layers} title="看板与图表功能">
            {/* Feature Toggles: Summary bar & Sparkline & WorldMap */}
            <div className="space-y-3">
              {/* 1. 顶部统计看板 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">顶部统计看板</span>
                  <span className="text-[10px] text-muted-foreground">打开网页时是否默认展开统计数据</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSummaryCollapsedChange(!summaryCollapsed)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5",
                    !summaryCollapsed
                      ? "bg-primary/15 border-primary text-primary shadow-2xs"
                      : "bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                  )}
                  title={!summaryCollapsed ? "顶部看板：当前默认展开（点击改为默认收起）" : "顶部看板：当前默认收起（点击改为默认展开）"}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-all",
                      !summaryCollapsed ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/60"
                    )}
                  />
                  <span>{!summaryCollapsed ? "默认展开" : "默认收起"}</span>
                </button>
              </div>

              {/* 1.5 搜索与筛选工具栏 */}
              {onToolbarExpandedChange && (
                <div className="flex items-center justify-between pt-1 border-t border-border/20">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground block">搜索与筛选工具栏</span>
                    <span className="text-[10px] text-muted-foreground">打开网页时是否默认展开节点搜索与筛选工具栏</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToolbarExpandedChange(!toolbarExpanded)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5",
                      toolbarExpanded
                        ? "bg-primary/15 border-primary text-primary shadow-2xs"
                        : "bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                    )}
                    title={toolbarExpanded ? "搜索与筛选栏：当前默认展开（点击改为默认收起）" : "搜索与筛选栏：当前默认收起（点击改为默认展开）"}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full transition-all",
                        toolbarExpanded ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/60"
                      )}
                    />
                    <span>{toolbarExpanded ? "默认展开" : "默认收起"}</span>
                  </button>
                </div>
              )}

              {/* 2. 实时网速折线图 */}
              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">实时网速折线图</span>
                  <span className="text-[10px] text-muted-foreground">在节点卡片上展示最近几分钟的波动折线</span>
                </div>
                <button
                  type="button"
                  onClick={() => onShowSparklineChange(!showSparkline)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5",
                    showSparkline
                      ? "bg-primary/15 border-primary text-primary shadow-2xs"
                      : "bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                  )}
                  title={showSparkline ? "实时网速折线图：当前已开启（点击隐藏）" : "实时网速折线图：当前已隐藏（点击开启）"}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-all",
                      showSparkline ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/60"
                    )}
                  />
                  <span>{showSparkline ? "已开启" : "已隐藏"}</span>
                </button>
              </div>

              {/* 3. 全球节点地图 */}
              <div className="flex items-center justify-between pt-1 border-t border-border/20">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">全球节点地图</span>
                  <span className="text-[10px] text-muted-foreground">打开网页时是否默认展开节点分布世界地图</span>
                </div>
                <button
                  type="button"
                  onClick={() => onShowMapChange(!showMap)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5",
                    showMap
                      ? "bg-primary/15 border-primary text-primary shadow-2xs"
                      : "bg-muted text-muted-foreground border-border/40 hover:text-foreground"
                  )}
                  title={showMap ? "全球节点地图：当前默认展开（点击改为默认收起）" : "全球节点地图：当前默认收起（点击改为默认展开）"}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-all",
                      showMap ? "bg-primary animate-pulse-dot" : "bg-muted-foreground/60"
                    )}
                  />
                  <span>{showMap ? "默认展开" : "默认收起"}</span>
                </button>
              </div>
            </div>
          </Section>

          {/* 6. 管理员全站设置保存 (仅管理员登录后可见) */}
          {isAuthed && onSaveSiteDefaults && (
            <div className="rounded-2xl p-4 border border-primary/30 bg-primary/5 space-y-2.5">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <Shield className="size-4 text-primary" />
                <span>管理员操作 · 保存为全站默认</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-normal">
                将当前界面的外观模式、强调色、纯黑白字色、卡片风格与壁纸配置直接写入服务端，作为所有未单独自定义过访客的默认视觉体验。
              </p>
              {siteSaveError && (
                <p className="text-[11px] font-medium text-destructive">{siteSaveError}</p>
              )}
              <button
                type="button"
                disabled={isSavingSite}
                onClick={async () => {
                  setIsSavingSite(true)
                  setSiteSaveError(null)
                  try {
                    await onSaveSiteDefaults()
                    setSiteSaveSuccess(true)
                    setTimeout(() => setSiteSaveSuccess(false), 2500)
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "保存失败，请检查网络或服务端权限"
                    setSiteSaveError(message)
                  } finally {
                    setIsSavingSite(false)
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-98 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingSite ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>正在同步保存至服务端…</span>
                  </>
                ) : siteSaveSuccess ? (
                  <>
                    <Check className="size-4 text-primary-foreground" />
                    <span>全站默认设置已保存成功！</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>保存当前效果为全站默认</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-card shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer active:scale-95",
              resetFeedback
                ? "bg-ok/10 text-ok font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title="恢复全部默认设置（清除本地自定义）"
          >
            {resetFeedback ? (
              <>
                <Check className="size-3 text-ok" />
                <span>已恢复默认</span>
              </>
            ) : (
              <>
                <RotateCcw className="size-3" />
                <span>恢复默认偏好</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition-all cursor-pointer active:scale-95"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
