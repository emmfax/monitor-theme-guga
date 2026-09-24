import manifest from "../../theme.json"

export type Palette = "ocean" | "emerald" | "iris" | "sunset" | "mono"
export type ThemeMode = "system" | "light" | "dark"
export type CardStyle = "solid" | "transparent" | "blur"

export type BgPreset = "none" | "bing_daily" | "bing_rand" | "custom"

export type ThemeConfig = {
  palette: Palette
  theme_mode: ThemeMode
  card_style: CardStyle
  bg_mask: number
  bg_preset: BgPreset
  bg_url: string
  notice: string
  show_sparkline: boolean
  show_map: boolean
  show_summary: boolean
  columns: number
  default_view: "grid" | "compact" | "list"
}

type Field = {
  key: string
  type: string
  default: unknown
  options?: { value: string }[]
  min?: number
  max?: number
}

function fits(field: Field, value: unknown): boolean {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= (field.min ?? -Infinity) &&
        value <= (field.max ?? Infinity)
      )
    case "select":
      return !!field.options?.some((option) => option.value === value)
    default:
      return typeof value === "string"
  }
}

export const fields = ((manifest.config || []) as Field[]).filter((f) => f.type !== "title")

export function resolveBgUrl(preset?: string, customUrl?: string): string {
  if (preset === "bing_daily") return "https://api.kdcc.cn/img/bing.php"
  if (preset === "bing_rand") return "https://bing.ee123.net/img/rand"
  if (preset === "custom") return (customUrl ?? "").trim()
  if (preset === "none") return ""
  return (customUrl ?? "").trim()
}

export async function loadConfig(): Promise<ThemeConfig> {
  let saved: Record<string, unknown> = {}
  try {
    const res = await fetch(`/api/themes/${manifest.short}/config`)
    if (res.ok) saved = await res.json()
  } catch {
    // network error or offline fallback to default
  }
  const loaded = Object.fromEntries(
    fields.map((f) => [f.key, fits(f, saved[f.key]) ? saved[f.key] : f.default])
  )
  const bgPreset = (loaded.bg_preset as BgPreset) || "none"
  const rawBgUrl = typeof loaded.bg_url === "string" ? loaded.bg_url : ""
  const effectiveBgUrl = resolveBgUrl(bgPreset, rawBgUrl)

  return {
    palette: (loaded.palette as Palette) || "mono",
    theme_mode: (loaded.theme_mode as ThemeMode) || "system",
    card_style: (loaded.card_style as CardStyle) || "solid",
    bg_mask: typeof loaded.bg_mask === "number" ? loaded.bg_mask : 35,
    bg_preset: bgPreset,
    bg_url: effectiveBgUrl,
    notice: (loaded.notice as string) || "",
    show_sparkline: loaded.show_sparkline !== false,
    show_map: Boolean(loaded.show_map),
    show_summary: Boolean(loaded.show_summary),
    columns: Number(loaded.columns) || 3,
    default_view: (loaded.default_view as "grid" | "compact" | "list") || "list",
  }
}

export async function saveConfig(values: Partial<ThemeConfig>): Promise<void> {
  const url = `/api/themes/${manifest.short}/config`
  let next: Record<string, unknown> = {}
  try {
    const read = await fetch(url)
    if (read.ok) {
      next = await read.json()
    }
  } catch {
    // fallback if read fails
  }

  for (const f of fields) {
    if (f.key in values) {
      const val = (values as Record<string, unknown>)[f.key]
      if (val === f.default) {
        delete next[f.key]
      } else {
        next[f.key] = val
      }
    }
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    if (res.status === 404 || errText.includes("no such endpoint")) {
      throw new Error("当前 Monitor Hub 服务端未开放主题配置接口（需 Hub > 1.2.0）。请在服务器执行一键脚本将 Monitor Hub 服务端升级至最新版后重试！")
    }
    if (res.status === 401) {
      throw new Error("保存失败：未登录或管理员会话已失效，请重新登录管理面板。")
    }
    if (res.status === 400) {
      throw new Error("保存失败：主题尚未在 Hub 中正确安装。")
    }
    throw new Error(errText || `保存失败 (${res.status})`)
  }
}

export async function clearConfig(): Promise<void> {
  const url = `/api/themes/${manifest.short}/config`
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    if (res.status === 404 || errText.includes("no such endpoint")) {
      // Hub <= 1.2.0 does not store theme configs in DB; consider it already clean on server
      return
    }
    if (res.status === 401) {
      throw new Error("清除失败：未登录或管理员会话已失效。")
    }
    throw new Error(errText || `清除失败 (${res.status})`)
  }
}
