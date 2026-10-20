import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const binDir = path.join(rootDir, 'src-tauri', 'bin')
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true })
}

const exeDest = path.join(binDir, 'kuma.exe')

// 1. Create empty placeholder if kuma.exe doesn't exist yet (to satisfy tauri-build resource check)
if (!fs.existsSync(exeDest)) {
  fs.writeFileSync(exeDest, '')
}

// 2. Compile kuma CLI in release mode
console.log('[build:kuma] Compiling kuma CLI in release mode...')
try {
  execSync('cargo build --release --bin kuma --manifest-path src-tauri/Cargo.toml', {
    cwd: rootDir,
    stdio: 'inherit',
  })
} catch (err) {
  console.error('[build:kuma] Cargo build failed:', err)
  process.exit(1)
}

// 3. Copy built binary over the placeholder
const exeSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'kuma.exe')
const unixSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'kuma')

if (fs.existsSync(exeSrc)) {
  fs.copyFileSync(exeSrc, exeDest)
} else if (fs.existsSync(unixSrc)) {
  fs.copyFileSync(unixSrc, exeDest)
} else {
  console.error('[build:kuma] Error: Built binary not found at expected location.')
  process.exit(1)
}

// 4. Strict verification: must exist and have non-zero size
if (!fs.existsSync(exeDest)) {
  console.error('[build:kuma] Error: Destination binary does not exist at ' + exeDest)
  process.exit(1)
}

const stats = fs.statSync(exeDest)
if (stats.size === 0) {
  console.error('[build:kuma] Error: Built binary size is 0 bytes!')
  process.exit(1)
}

console.log(`[build:kuma] Successfully compiled and verified kuma binary (${stats.size} bytes) at ${exeDest}`)
