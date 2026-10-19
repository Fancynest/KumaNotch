import React, { useState, useRef } from 'react'
import {
  FolderOpen,
  ExternalLink,
  Plus,
  Check,
  X,
  FileText,
  FileImage,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  File,
} from 'lucide-react'
import { globalFreshFileEngine, type FreshFileInfo } from '../../core/freshFile'
import { formatFileSize, getFileCategory } from '../../core/shelf'
import { getT } from '../../core/i18n'
import { globalSettingsEngine } from '../../core/settings'

interface FreshFileCardProps {
  file: FreshFileInfo
  onClose: () => void
}

function renderFileIcon(name: string, _ext: string) {
  const cat = getFileCategory(name, false)
  const iconClass = 'w-7 h-7 shrink-0'

  switch (cat) {
    case 'image':
      return <FileImage className={`${iconClass} text-sky-400`} />
    case 'pdf':
    case 'word':
    case 'text':
      return <FileText className={`${iconClass} text-rose-400`} />
    case 'archive':
      return <FileArchive className={`${iconClass} text-purple-400`} />
    case 'code':
      return <FileCode className={`${iconClass} text-cyan-400`} />
    case 'video':
      return <FileVideo className={`${iconClass} text-violet-400`} />
    case 'audio':
      return <FileAudio className={`${iconClass} text-pink-400`} />
    default:
      return <File className={`${iconClass} text-white/70`} />
  }
}

export const FreshFileCard: React.FC<FreshFileCardProps> = ({ file, onClose }) => {
  const settings = globalSettingsEngine.getSettings()
  const t = getT(settings.language)
  const [addedToShelf, setAddedToShelf] = useState(false)
  const isDraggingOut = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    pointerStart.current = { x: e.clientX, y: e.clientY }
    isDraggingOut.current = false
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current || isDraggingOut.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.hypot(dx, dy) > 5) {
      isDraggingOut.current = true
      pointerStart.current = null
      globalFreshFileEngine.startDrag(file.path)
    }
  }

  const handlePointerUp = () => {
    pointerStart.current = null
  }

  const handleAddToShelf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await globalFreshFileEngine.addToShelf(file.path)
    setAddedToShelf(true)
    setTimeout(() => setAddedToShelf(false), 2000)
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    globalFreshFileEngine.openFile(file.path)
  }

  const handleShowInFolder = (e: React.MouseEvent) => {
    e.stopPropagation()
    globalFreshFileEngine.showInFolder(file.path)
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    globalFreshFileEngine.dismiss()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-label={t.freshFile}
      className="absolute inset-0 px-4 py-3 flex flex-col justify-between text-white select-none overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => globalFreshFileEngine.pauseCountdown()}
      onMouseLeave={() => globalFreshFileEngine.resumeCountdown()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-tight text-sky-300">
            {t.freshFile}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 font-mono">
            {file.extension.toUpperCase() || 'FILE'}
          </span>
        </div>

        <button
          onClick={handleDismiss}
          className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          title={t.dismiss}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex items-center gap-3.5 py-1.5 flex-1 min-h-0">
        {/* Large Thumbnail with Native Drag Capability */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          draggable="true"
          onDragStart={(e) => {
            e.preventDefault()
            isDraggingOut.current = true
            globalFreshFileEngine.startDrag(file.path)
          }}
          className="relative w-20 h-20 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center overflow-hidden shrink-0 cursor-grab active:cursor-grabbing hover:border-sky-400/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all group"
          title={t.dragOutThumbnail}
        >
          {file.thumbnail ? (
            <img
              src={file.thumbnail}
              alt={file.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            renderFileIcon(file.name, file.extension)
          )}

          {/* Drag Overlay Hint on Hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[9px] text-sky-200 font-medium text-center px-1">
            <span>{t.dragOutHint}</span>
          </div>
        </div>

        {/* File Details & Actions */}
        <div className="flex flex-col justify-between flex-1 min-w-0 h-full py-0.5">
          <div className="space-y-0.5">
            <h4
              className="text-xs font-semibold text-white/95 truncate leading-tight"
              title={file.name}
            >
              {file.name}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
              <span>{formatFileSize(file.size, false)}</span>
              <span>•</span>
              <span className="truncate max-w-[140px] text-white/30" title={file.path}>
                {file.path.split(/[/\\]/).slice(-2, -1)[0] || 'Desktop'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1.5">
            {/* Add to Shelf */}
            <button
              onClick={handleAddToShelf}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                addedToShelf
                  ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-300'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white/90 active:scale-95'
              }`}
              title={t.addToShelf}
            >
              {addedToShelf ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>{t.addedToShelf}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 text-sky-400" />
                  <span>{t.addToShelf}</span>
                </>
              )}
            </button>

            {/* Open File */}
            <button
              onClick={handleOpen}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-[10px] font-medium transition-colors active:scale-95"
              title={t.openFile}
            >
              <ExternalLink className="w-3 h-3" />
              <span>{t.openFile}</span>
            </button>

            {/* Show in folder */}
            <button
              onClick={handleShowInFolder}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/60 hover:text-white transition-colors active:scale-95"
              title={t.showInFolder}
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Footer */}
      <div className="pt-1 flex items-center justify-between text-[9px] text-white/30 border-t border-white/5">
        <span className="truncate">{t.dragOutThumbnail}</span>
        <button
          onClick={handleDismiss}
          className="text-white/40 hover:text-white hover:underline transition-colors ml-2"
        >
          {t.dismiss}
        </button>
      </div>
    </div>
  )
}
