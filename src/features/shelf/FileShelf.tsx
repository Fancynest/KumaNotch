import React, { useState, useEffect } from 'react'
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Music,
  Video,
  Trash2,
  Copy,
  Check,
  UploadCloud,
  AlertTriangle,
  GripVertical,
  ChevronLeft,
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import {
  globalShelfEngine,
  formatFileSize,
  getFileCategory,
  type ShelfItem,
} from '../../core/shelf'
import { getT } from '../../core/i18n'

interface FileShelfProps {
  isDragOver?: boolean
  onBack?: () => void
}

export function FileShelf({ isDragOver = false, onBack }: FileShelfProps) {
  const t = getT()
  const [items, setItems] = useState<ShelfItem[]>(() => globalShelfEngine.getItems())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    return globalShelfEngine.subscribe((newItems) => {
      setItems(newItems)
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

  const handleStartDrag = (e: React.MouseEvent, item: ShelfItem) => {
    // Only trigger native drag on left click drag
    if (e.button !== 0) return
    try {
      invoke('shelf_start_drag', { paths: [item.path] }).catch((err) => {
        console.debug('Native drag fallback:', err)
      })
    } catch (err) {
      console.debug('Native drag error:', err)
    }
  }

  const renderIcon = (item: ShelfItem) => {
    const cat = getFileCategory(item.name, item.isDir)
    const iconClass = 'w-4 h-4 shrink-0'
    switch (cat) {
      case 'folder':
        return <Folder className={`${iconClass} text-amber-400`} />
      case 'image':
        return <ImageIcon className={`${iconClass} text-sky-400`} />
      case 'archive':
        return <FileArchive className={`${iconClass} text-purple-400`} />
      case 'code':
        return <FileCode className={`${iconClass} text-emerald-400`} />
      case 'audio':
        return <Music className={`${iconClass} text-pink-400`} />
      case 'video':
        return <Video className={`${iconClass} text-indigo-400`} />
      case 'pdf':
      case 'doc':
        return <FileText className={`${iconClass} text-amber-300`} />
      default:
        return <File className={`${iconClass} text-white/60`} />
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full h-full justify-between">
      {/* Shelf Header */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-[10px] font-medium transition-all active:scale-95 mr-0.5"
              title={t.backToHome}
            >
              <ChevronLeft className="w-3 h-3 text-white/50" />
              <span>{t.backToHome}</span>
            </button>
          )}
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
            {t.fileShelf}
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/60 font-mono font-medium">
            {items.length}/10
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={() => globalShelfEngine.clear()}
            className="text-[10px] text-white/40 hover:text-red-400 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t.clearAll}</span>
          </button>
        )}
      </div>

      {/* Drop Target or Items List */}
      <div
        className={`relative w-full rounded-xl transition-all duration-200 flex-1 flex flex-col justify-center ${
          isDragOver
            ? 'border-2 border-dashed border-amber-400 bg-amber-500/15 p-3'
            : items.length === 0
            ? 'border border-dashed border-white/15 bg-white/[0.03] p-3'
            : 'border border-white/10 bg-white/[0.03] p-1 justify-start'
        }`}
      >
        {isDragOver ? (
          <div className="flex flex-col items-center justify-center py-6 text-amber-300 animate-pulse gap-1">
            <UploadCloud className="w-6 h-6" />
            <span className="text-xs font-medium">{t.dropFilesHere}</span>
          </div>
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
          <div className="shelf-file-list flex flex-col gap-1 max-h-[135px] overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-white/20">
            {items.map((item) => (
              <div
                key={item.id}
                onMouseDown={(e) => handleStartDrag(e, item)}
                onClick={() => globalShelfEngine.openItem(item.path)}
                title={`${item.name}\n${item.path}\n(${t.dragOutHint})`}
                className={`shelf-item group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                  item.exists
                    ? 'hover:bg-white/10 bg-white/[0.04] text-white/90'
                    : 'bg-red-500/10 hover:bg-red-500/20 text-white/60'
                }`}
              >
                {/* Drag Grip + Icon + Info */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <GripVertical className="w-3 h-3 text-white/20 group-hover:text-white/50 shrink-0" />
                  {renderIcon(item)}
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

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 ml-1">
                  {/* Show in folder */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      globalShelfEngine.showInFolder(item.path)
                    }}
                    title={t.showInFolder}
                    className="p-1 rounded hover:bg-white/15 text-white/50 hover:text-white transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy Path */}
                  <button
                    onClick={(e) => handleCopyPath(e, item)}
                    title={copiedId === item.id ? t.copied : t.copyPath}
                    className="p-1 rounded hover:bg-white/15 text-white/50 hover:text-white transition-colors"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Remove */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      globalShelfEngine.removeItem(item.id)
                    }}
                    title="Remove"
                    className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
