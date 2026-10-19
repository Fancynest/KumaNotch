import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('[build:kuma] Compiling kuma CLI in release mode...')
execSync('cargo build --release --bin kuma --manifest-path src-tauri/Cargo.toml', {
  cwd: rootDir,
  stdio: 'inherit',
})

const binDir = path.join(rootDir, 'src-tauri', 'bin')
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true })
}

const exeSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'kuma.exe')
const exeDest = path.join(binDir, 'kuma.exe')

if (fs.existsSync(exeSrc)) {
  fs.copyFileSync(exeSrc, exeDest)
  console.log(`[build:kuma] Successfully copied to ${exeDest}`)
} else {
  const unixSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'kuma')
  if (fs.existsSync(unixSrc)) {
    fs.copyFileSync(unixSrc, path.join(binDir, 'kuma'))
    console.log(`[build:kuma] Successfully copied to ${binDir}/kuma`)
  } else {
    console.warn('[build:kuma] Warning: Built binary not found at expected location.')
  }
}
