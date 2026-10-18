import { invoke } from '@tauri-apps/api/core'

export interface ShelfItem {
  id: string
  path: string
  name: string
  size: number
  isDir: boolean
  addedAt: number
  exists: boolean
  extension: string
}

const STORAGE_KEY = 'kumanotch_shelf_items'
const MAX_SHELF_ITEMS = 10

export function formatFileSize(bytes: number, isDir: boolean): string {
  if (isDir) return 'Folder'
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)
  return `${formatted} ${units[i]}`
}

export function getFileCategory(name: string, isDir: boolean): 'folder' | 'image' | 'archive' | 'code' | 'audio' | 'video' | 'pdf' | 'doc' | 'file' {
  if (isDir) return 'folder'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive'
  if (['pdf'].includes(ext)) return 'pdf'
  if (['doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'csv', 'xlsx', 'pptx'].includes(ext)) return 'doc'
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'c', 'cpp', 'java', 'go'].includes(ext)) return 'code'
  if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio'
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(ext)) return 'video'
  return 'file'
}

type ShelfListener = (items: ShelfItem[]) => void
type ShelfFullListener = () => void

class ShelfEngine {
  private items: ShelfItem[] = []
  private listeners: Set<ShelfListener> = new Set()
  private fullListeners: Set<ShelfFullListener> = new Set()

  constructor() {
    this.items = this.load()
    this.verifyExistence()
  }

  private load(): ShelfItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed.slice(0, MAX_SHELF_ITEMS)
        }
      }
    } catch (e) {
      console.warn('Failed to load shelf items:', e)
    }
    return []
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items))
    } catch (e) {
      console.warn('Failed to save shelf items:', e)
    }
    this.notify()
  }

  private notify(): void {
    const copy = [...this.items]
    this.listeners.forEach((listener) => {
      try {
        listener(copy)
      } catch (err) {
        console.error('Shelf listener error:', err)
      }
    })
  }

  public notifyFull(): void {
    this.fullListeners.forEach((listener) => {
      try {
        listener()
      } catch (err) {
        console.error('Shelf full listener error:', err)
      }
    })
  }

  public onShelfFull(listener: ShelfFullListener): () => void {
    this.fullListeners.add(listener)
    return () => {
      this.fullListeners.delete(listener)
    }
  }

  public getItems(): ShelfItem[] {
    return [...this.items]
  }

  public subscribe(listener: ShelfListener): () => void {
    this.listeners.add(listener)
    listener([...this.items])
    return () => {
      this.listeners.delete(listener)
    }
  }

  public reorder(items: ShelfItem[]): void {
    this.items = [...items].slice(0, MAX_SHELF_ITEMS)
    this.save()
  }

  public async addPaths(paths: string[]): Promise<void> {
    if (!paths || paths.length === 0) return

    if (this.items.length >= MAX_SHELF_ITEMS) {
      this.notifyFull()
      return
    }

    try {
      // Query metadata from Rust
      const metadataList = await invoke<
        Array<{
          path: string
          name: string
          size: number
          is_dir: boolean
          exists: boolean
          extension: string
        }>
      >('shelf_get_metadata', { paths })

      const newItems: ShelfItem[] = []

      for (const meta of metadataList) {
        // Skip duplicate paths
        if (this.items.some((it) => it.path.toLowerCase() === meta.path.toLowerCase())) {
          continue
        }
        newItems.push({
          id: `shelf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          path: meta.path,
          name: meta.name,
          size: meta.size,
          isDir: meta.is_dir,
          exists: meta.exists,
          extension: meta.extension,
          addedAt: Date.now(),
        })
      }

      if (newItems.length > 0) {
        if (this.items.length + newItems.length > MAX_SHELF_ITEMS) {
          this.notifyFull()
        }
        // Prepend newest items and clamp to max limit
        this.items = [...newItems, ...this.items].slice(0, MAX_SHELF_ITEMS)
        this.save()
      }
    } catch (err) {
      console.error('Failed to get metadata for paths:', err)
    }
  }

  public removeItem(id: string): void {
    this.items = this.items.filter((it) => it.id !== id)
    this.save()
  }

  public clear(): void {
    this.items = []
    this.save()
  }

  public async openItem(path: string): Promise<void> {
    try {
      await invoke('shelf_open_path', { path })
    } catch (err) {
      console.error('Failed to open path:', err)
    }
  }

  public async showInFolder(path: string): Promise<void> {
    try {
      await invoke('shelf_show_in_folder', { path })
    } catch (err) {
      console.error('Failed to show in folder:', err)
    }
  }

  public async copyPath(path: string): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(path)
          return true
        } catch (clipErr) {
          console.debug('Navigator clipboard error, falling back to Rust:', clipErr)
        }
      }
      await invoke('shelf_copy_path', { path })
      return true
    } catch (err) {
      console.error('Failed to copy path:', err)
      return false
    }
  }

  public async verifyExistence(): Promise<void> {
    if (this.items.length === 0) return
    try {
      const paths = this.items.map((it) => it.path)
      const results = await invoke<Record<string, boolean>>('shelf_check_exists', { paths })
      let changed = false
      this.items = this.items.map((it) => {
        const stillExists = results[it.path] ?? it.exists
        if (stillExists !== it.exists) {
          changed = true
          return { ...it, exists: stillExists }
        }
        return it
      })
      if (changed) {
        this.save()
      }
    } catch {}
  }
}

export const globalShelfEngine = new ShelfEngine()
