import React, { useState, useEffect } from 'react'
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileArchive,
  FileImage,
  FileAudio,
  FileVideo,
  FileJson,
  Trash2,
  Copy,
  Check,
  UploadCloud,
  AlertTriangle,
  GripVertical,
  ChevronDown,
  Sparkles,
  Plus,
} from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import {
  globalShelfEngine,
  formatFileSize,
  getFileCategory,
  type ShelfItem,
} from '../../core/shelf'
import { globalFreshFileEngine, type FreshFileInfo } from '../../core/freshFile'
import { getT } from '../../core/i18n'

interface FileShelfProps {
  isDragOver?: boolean
  onClose?: () => void
}

function renderFileIcon(item: ShelfItem) {
  const cat = getFileCategory(item.name, item.isDir)
  const iconClass = 'w-3.5 h-3.5 shrink-0'

  switch (cat) {
    case 'folder':
      return (
        <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <Folder className={`${iconClass} text-amber-400`} />
        </div>
      )
    case 'word':
      return (
        <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
          <FileText className={`${iconClass} text-blue-400`} />
        </div>
      )
    case 'excel':
      return (
        <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <FileSpreadsheet className={`${iconClass} text-emerald-400`} />
        </div>
      )
    case 'powerpoint':
      return (
        <div className="w-6 h-6 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
          <Presentation className={`${iconClass} text-orange-400`} />
        </div>
      )
    case 'pdf':
      return (
        <div className="w-6 h-6 rounded-md bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
          <FileText className={`${iconClass} text-rose-400`} />
        </div>
      )
    case 'image':
      return (
        <div className="w-6 h-6 rounded-md bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0">
          <FileImage className={`${iconClass} text-sky-400`} />
        </div>
      )
    case 'archive':
      return (
        <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
          <FileArchive className={`${iconClass} text-purple-400`} />
        </div>
      )
    case 'code':
      return (
        <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
          <FileCode className={`${iconClass} text-cyan-400`} />
        </div>
      )
    case 'data':
      return (
        <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <FileJson className={`${iconClass} text-amber-300`} />
        </div>
      )
    case 'audio':
      return (
        <div className="w-6 h-6 rounded-md bg-pink-500/15 border border-pink-500/25 flex items-center justify-center shrink-0">
          <FileAudio className={`${iconClass} text-pink-400`} />
        </div>
      )
    case 'video':
      return (
        <div className="w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <FileVideo className={`${iconClass} text-violet-400`} />
        </div>
      )
    case 'text':
      return (
        <div className="w-6 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
          <FileText className={`${iconClass} text-slate-300`} />
        </div>
      )
    default:
      return (
        <div className="w-6 h-6 rounded-md bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
          <File className={`${iconClass} text-white/70`} />
        </div>
      )
  }
}

interface ShelfItemRowProps {
  item: ShelfItem
  copied: boolean
  onCopy: (e: React.MouseEvent, item: ShelfItem) => void
  onShowInFolder: (path: string) => void
  onRemove: (id: string) => void
  onOpen: (path: string) => void
}

function ShelfItemRow({
  item,
  copied,
  onCopy,
  onShowInFolder,
  onRemove,
  onOpen,
}: ShelfItemRowProps) {
  const t = getT()
  const controls = useDragControls()
  const isDraggingOut = React.useRef(false)
  const pointerStart = React.useRef<{ x: number; y: number } | null>(null)

  const handleFilePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    pointerStart.current = { x: e.clientX, y: e.clientY }
    isDraggingOut.current = false
  }

  const handleFilePointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current || isDraggingOut.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.hypot(dx, dy) > 5) {
      isDraggingOut.current = true
      pointerStart.current = null
      globalShelfEngine.startDrag([item.path])
    }
  }

  const handleFilePointerUp = () => {
    pointerStart.current = null
  }

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={controls}
      className={`shelf-item group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors select-none ${
        item.exists
          ? 'hover:bg-white/10 bg-white/[0.04] text-white/90'
          : 'bg-red-500/10 hover:bg-red-500/20 text-white/60'
      }`}
    >
      {/* Drag Grip Handle for List Reordering */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation()
          controls.start(e)
        }}
        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/25 hover:text-white/80 transition-colors touch-none shrink-0"
        title={t.reorderHint}
      >
        <GripVertical className="w-3.5 h-3.5 shrink-0" />
      </div>

      {/* File Info & Icon (Click to open, Drag out to other apps) */}
      <div
        onPointerDown={handleFilePointerDown}
        onPointerMove={handleFilePointerMove}
        onPointerUp={handleFilePointerUp}
        onPointerCancel={handleFilePointerUp}
        draggable="true"
        onDragStart={(e) => {
          e.preventDefault()
          isDraggingOut.current = true
          globalShelfEngine.startDrag([item.path])
        }}
        onClick={(e) => {
          if (isDraggingOut.current) {
            e.stopPropagation()
            return
          }
          onOpen(item.path)
        }}
        className="shelf-file-draggable flex items-center gap-1.5 min-w-0 flex-1 cursor-grab active:cursor-grabbing select-none"
        title={t.clickToOpenOrDrag}
      >
        {renderFileIcon(item)}

        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate text-[11px] font-medium leading-tight">
            {item.name}
          </span>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40 leading-none">
            <span>{formatFileSize(item.size, item.isDir)}</span>
            {!item.exists && (
              <span className="text-red-400 flex items-center gap-0.5 font-medium">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t.missing}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row Action Buttons */}
      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 ml-1">
        {/* Show in folder */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onShowInFolder(item.path)
          }}
          title={t.showInFolder}
          className="p-1 rounded hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        {/* Copy Path */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onCopy(e, item)
          }}
          title={copied ? t.copied : t.copyPath}
          className="p-1 rounded hover:bg-white/15 text-white/50 hover:text-white transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Remove item */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(item.id)
          }}
          title={t.remove}
          className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Reorder.Item>
  )
}

export function FileShelf({ isDragOver = false, onClose }: FileShelfProps) {
  const t = getT()
  const [items, setItems] = useState<ShelfItem[]>(() => globalShelfEngine.getItems())
  const [recentFresh, setRecentFresh] = useState<FreshFileInfo[]>(() =>
    globalFreshFileEngine.getRecentFiles(),
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isFullWarning, setIsFullWarning] = useState<boolean>(false)

  useEffect(() => {
    return globalShelfEngine.subscribe((newItems) => {
      setItems(newItems)
    })
  }, [])

  useEffect(() => {
    return globalFreshFileEngine.subscribe((_active, recent) => {
      setRecentFresh([...recent])
    })
  }, [])

  useEffect(() => {
    return globalShelfEngine.onShelfFull(() => {
      setIsFullWarning(true)
      const timer = setTimeout(() => setIsFullWarning(false), 3500)
      return () => clearTimeout(timer)
    })
  }, [])

  const handleCopyPath = async (e: React.MouseEvent, item: ShelfItem) => {
    e.stopPropagation()
    const ok = await globalShelfEngine.copyPath(item.path)
    if (ok) {
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  const handleReorder = (newItems: ShelfItem[]) => {
    setItems(newItems)
    globalShelfEngine.reorder(newItems)
  }

  return (
    <div className="flex flex-col gap-1.5 w-full h-full justify-between">
      {/* Shelf Header */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
            {t.fileShelf}
          </span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-medium transition-colors ${
              items.length >= 10
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {items.length}/10
          </span>
        </div>

        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              onClick={() => globalShelfEngine.clear()}
              className="text-[10px] text-white/40 hover:text-red-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 mr-0.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.clearAll}</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
              title={t.collapse}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Session Recent Strip "Baru" (Spec Fase 6a: 5 file terakhir sesi ini di atas shelf) */}
      {recentFresh.length > 0 && !isDragOver && (
        <div className="flex flex-col gap-1 shrink-0 px-0.5 py-1 rounded-lg bg-sky-500/[0.07] border border-sky-500/15">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-sky-400" />
              {t.recentFiles}
            </span>
            <span className="text-[8px] text-white/30 font-mono">
              {recentFresh.length}
            </span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto px-0.5 scrollbar-none">
            {recentFresh.map((rf) => (
              <div
                key={rf.id}
                onClick={() => globalFreshFileEngine.openFile(rf.path)}
                draggable="true"
                onDragStart={(e) => {
                  e.preventDefault()
                  globalFreshFileEngine.startDrag(rf.path)
                }}
                className="group flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/80 shrink-0 cursor-grab active:cursor-grabbing text-[10px] select-none transition-all"
                title={`${rf.name} • ${t.clickToOpenOrDrag}`}
              >
                {rf.thumbnail ? (
                  <img
                    src={rf.thumbnail}
                    alt={rf.name}
                    className="w-3.5 h-3.5 object-cover rounded shrink-0"
                  />
                ) : (
                  <File className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
                <span className="truncate max-w-[70px] text-[10px] font-medium leading-none">
                  {rf.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    globalFreshFileEngine.addToShelf(rf.path)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-sky-400/20 text-sky-300 transition-opacity"
                  title={t.addToShelf}
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shelf Full Warning Toast */}
      {isFullWarning && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-medium animate-pulse shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span className="truncate">{t.shelfFull}</span>
        </div>
      )}

      {/* Drop Target or Items List */}
      <div
        className={`relative w-full rounded-xl transition-all duration-200 flex-1 flex flex-col justify-center overflow-hidden ${
          isDragOver
            ? items.length >= 10
              ? 'border-2 border-dashed border-red-400 bg-red-500/15 p-3'
              : 'border-2 border-dashed border-amber-400 bg-amber-500/15 p-3'
            : items.length === 0
            ? 'border border-dashed border-white/15 bg-white/[0.03] p-3'
            : 'border border-white/10 bg-white/[0.03] p-1 justify-start'
        }`}
      >
        {isDragOver ? (
          items.length >= 10 ? (
            <div className="flex flex-col items-center justify-center py-5 text-red-400 animate-pulse gap-1">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <span className="text-xs font-semibold">{t.shelfFull}</span>
              <span className="text-[10px] text-white/50">{t.shelfFullSub}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-amber-300 animate-pulse gap-1">
              <UploadCloud className="w-6 h-6" />
              <span className="text-xs font-medium">{t.dropFilesHere}</span>
            </div>
          )
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-white/40 gap-1.5">
            <UploadCloud className="w-6 h-6 text-white/30" />
            <span className="text-[11px] text-center leading-tight font-medium text-white/70">
              {t.emptyShelfDesc}
            </span>
            <span className="text-[10px] text-white/30 font-medium">
              {t.dragOutHint}
            </span>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={handleReorder}
            className="shelf-file-list flex flex-col gap-1 max-h-[135px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-white/20"
          >
            {items.map((item) => (
              <ShelfItemRow
                key={item.id}
                item={item}
                copied={copiedId === item.id}
                onCopy={handleCopyPath}
                onShowInFolder={(path) => globalShelfEngine.showInFolder(path)}
                onRemove={(id) => globalShelfEngine.removeItem(id)}
                onOpen={(path) => globalShelfEngine.openItem(path)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  )
}
