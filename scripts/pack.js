import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "theme.json"), "utf-8"))
const SHORT = manifest.short || "expressive"

console.log(`📦 Packaging theme "${manifest.name}" (short: ${SHORT})...`)

// 1. Build dist if missing
if (!fs.existsSync(path.join(ROOT, "dist", "index.html"))) {
  console.log("🔨 Running build first...")
  execSync("npm.cmd run build", { stdio: "inherit", cwd: ROOT })
}

// 2. Package directly as required by monitor-hub:
// The official hub release workflow uses:
//   tar czf theme.tar.gz dist theme.json preview.png
// so that theme.json is at the ROOT of the archive.
const TAR_NAME = "theme.tar.gz"
const TAR_PATH = path.join(ROOT, TAR_NAME)

console.log(`🗜️ Compressing into ${TAR_NAME}...`)
const filesToPack = ["dist", "theme.json"]
if (fs.existsSync(path.join(ROOT, "preview.png"))) {
  filesToPack.push("preview.png")
}

execSync(`tar -czf "${TAR_NAME}" ${filesToPack.join(" ")}`, {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, GZIP: "-9" },
})

// Also duplicate to expressive.tar.gz
fs.copyFileSync(TAR_PATH, path.join(ROOT, `${SHORT}.tar.gz`))

const stat = fs.statSync(TAR_PATH)
console.log(`✅ Success! Created ${TAR_NAME} (${(stat.size / 1024).toFixed(1)} KB)`)

const list = execSync(`tar -tzf "${TAR_PATH}"`, { encoding: "utf-8" }).split("\n").filter(Boolean)
console.log(`📂 Package layout inside ${TAR_NAME} (${list.length} files):`)
list.slice(0, 10).forEach((f) => console.log("   " + f))
if (list.length > 10) console.log(`   ... and ${list.length - 10} more files`)
