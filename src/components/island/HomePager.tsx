import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, ChevronDown, Hourglass, Music2, Clock, Terminal, Search } from 'lucide-react'
import { FileShelf } from '../../features/shelf/FileShelf'
import { ExpandedMusic } from '../../features/media/ExpandedMusic'
import { globalTimerEngine, formatTimeDisplay, type TimerData } from '../../core/timer'
import type { MediaData } from '../../core/media'
import { getT } from '../../core/i18n'
import { globalSettingsEngine } from '../../core/settings'
import { globalProcessWatcherEngine, type PostActionState } from '../../core/processWatcher'

interface HomePagerProps {
  homePage: number
  setHomePage: (page: number) => void
  dateStr: string
  timeStr: string
  timerData: TimerData | null
  remainingSeconds: number
  mediaData: MediaData | null
  isDragOver: boolean
  showCustomInput: boolean
  setShowCustomInput: (show: boolean) => void
  onClose: () => void
  onOpenSettings: () => void
  onOpenTimer: () => void
}

export const HomePager: React.FC<HomePagerProps> = ({
  homePage,
  setHomePage,
  dateStr,
  timeStr,
  timerData,
  remainingSeconds,
  mediaData,
  isDragOver,
  showCustomInput,
  setShowCustomInput,
  onClose,
  onOpenSettings,
  onOpenTimer,
}) => {
  const settings = globalSettingsEngine.getSettings()
  const t = getT(settings.language)

  const [customHours, setCustomHours] = useState('0')
  const [customMins, setCustomMins] = useState('0')
  const [customSecs, setCustomSecs] = useState('0')
  const customMinsInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput && customMinsInputRef.current) {
      customMinsInputRef.current.focus({ preventScroll: true })
      customMinsInputRef.current.select()
    }
  }, [showCustomInput])

  const [postActionState, setPostActionState] = useState<PostActionState | null>(() =>
    globalProcessWatcherEngine.getPostAction()
  )
  const [showProcessWatch, setShowProcessWatch] = useState(false)
  const [processList, setProcessList] = useState<Array<{ pid: number; name: string }>>([])
  const [processSearch, setProcessSearch] = useState('')
  const [selectedPostAction, setSelectedPostAction] = useState<string>('none')

  useEffect(() => {
    return globalProcessWatcherEngine.subscribe(({ postAction }) => {
      setPostActionState(postAction)
    })
  }, [])

  useEffect(() => {
    if (showProcessWatch) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke<Array<{ pid: number; name: string }>>('get_running_processes')
            .then((list) => setProcessList(list))
            .catch((err) => console.error('Failed to load processes:', err))
        })
      }
    }
  }, [showProcessWatch])

  const handleWatchProcess = async (pid: number, name: string) => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('watch_process', {
          pid,
          name,
          postAction: selectedPostAction === 'none' ? null : selectedPostAction,
        })
        setShowProcessWatch(false)
        onClose()
      } catch (err) {
        console.error('Failed to watch process:', err)
      }
    }
  }

  // Wheel and swipe gesture handling
  const lastWheelTime = useRef<number>(0)
  const pointerStartX = useRef<number | null>(null)
  const isSwiping = useRef<boolean>(false)

  const handleHomeWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTime.current < 260) return

    const dx = e.deltaX
    const dy = e.deltaY

    const target = e.target as HTMLElement | null
    const fileList = target?.closest('.shelf-file-list') as HTMLElement | null

    if (homePage === 2 && fileList) {
      const canScrollDown =
        fileList.scrollHeight > fileList.clientHeight &&
        fileList.scrollTop + fileList.clientHeight < fileList.scrollHeight - 2
      const canScrollUp = fileList.scrollTop > 2

      if (dy > 10 && canScrollDown) return
      if (dy < -10 && canScrollUp) return
    }

    if (dx > 15 || dy > 15) {
      if (homePage === 0) {
        lastWheelTime.current = now
        setHomePage(1)
      } else if (homePage === 1) {
        lastWheelTime.current = now
        setHomePage(2)
      }
    } else if (dx < -15 || dy < -15) {
      if (homePage === 2) {
        lastWheelTime.current = now
        setHomePage(1)
      } else if (homePage === 1) {
        lastWheelTime.current = now
        setHomePage(0)
      }
    }
  }

  const handleHomePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target?.closest('button, input, select, textarea, [data-shelf-item], .shelf-item')) return
    pointerStartX.current = e.clientX
    isSwiping.current = true
  }

  const handleHomePointerUp = (e: React.PointerEvent) => {
    if (!isSwiping.current || pointerStartX.current === null) return
    const diffX = e.clientX - pointerStartX.current
    const threshold = 30

    if (diffX < -threshold) {
      if (homePage === 0) setHomePage(1)
      else if (homePage === 1) setHomePage(2)
    } else if (diffX > threshold) {
      if (homePage === 2) setHomePage(1)
      else if (homePage === 1) setHomePage(0)
    }

    isSwiping.current = false
    pointerStartX.current = null
  }

  const handleDurationInput = (
    raw: string,
    max: number,
    setter: (val: string) => void,
  ) => {
    const digits = raw.replace(/\D/g, '')
    if (digits === '') {
      setter('')
      return
    }
    const stripped = digits.replace(/^0+(?=\d)/, '')
    const num = parseInt(stripped, 10) || 0
    const clamped = Math.min(max, num)
    setter(clamped.toString())
  }

  const handleStartCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const h = parseInt(customHours, 10) || 0
    const m = parseInt(customMins, 10) || 0
    const s = parseInt(customSecs, 10) || 0
    const totalSecs = Math.max(0, h) * 3600 + Math.max(0, m) * 60 + Math.max(0, s)
    if (totalSecs > 0) {
      globalTimerEngine.startTimerSeconds(totalSecs)
      setShowCustomInput(false)
      onClose()
    }
  }

  const isTimerActive = timerData !== null && (timerData.status === 'running' || timerData.status === 'paused')
  const isTimerRunning = timerData?.status === 'running'
  const isMediaActive = mediaData !== null && mediaData.isActive

  return (
    <div
      className="absolute inset-0 flex flex-col justify-between text-white cursor-default overflow-hidden select-none touch-none"
      onClick={(e) => e.stopPropagation()}
      onWheel={handleHomeWheel}
      onPointerDown={handleHomePointerDown}
      onPointerUp={handleHomePointerUp}
      onPointerLeave={handleHomePointerUp}
      onPointerCancel={handleHomePointerUp}
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0
        e.currentTarget.scrollTop = 0
      }}
    >
      {/* Horizontal Slider Content */}
      <div
        className="relative flex-1 w-full overflow-hidden"
        onScroll={(e) => {
          e.currentTarget.scrollLeft = 0
          e.currentTarget.scrollTop = 0
        }}
      >
        <motion.div
          animate={{
            x: homePage === 0 ? '0%' : homePage === 1 ? '-33.333333%' : '-66.666666%',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="flex w-[300%] h-full"
        >
          {/* Page 0: Dedicated Music Player (Kiri) */}
          <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
            <ExpandedMusic
              onClose={onClose}
              onOpenTimer={onOpenTimer}
              isTimerActive={isTimerActive}
            />
          </div>

          {/* Page 1: Clock & Quick Timer (Tengah / Default) */}
          <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
            <div>
              {/* Top Bar: Date & Collapse Button */}
              <div className="flex items-center justify-between">
                <span
                  onClick={onClose}
                  className="text-xs font-semibold text-white/50 hover:text-white/80 cursor-pointer uppercase tracking-wider transition-colors"
                  title={t.clickToCollapse}
                >
                  {dateStr}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowProcessWatch(!showProcessWatch)}
                    className={`p-1 rounded-full transition-colors active:scale-95 ${
                      showProcessWatch
                        ? 'text-amber-300 bg-amber-500/20'
                        : 'text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                    title="Pantau Proses (Mode A)"
                    aria-label="Pantau Proses"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onOpenSettings}
                    className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    title={t.settings}
                    aria-label={t.settings}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    title={t.collapse}
                    aria-label={t.collapse}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Post-Action Countdown Banner (Cancels even if card was closed) */}
              {postActionState && !postActionState.isCancelled && postActionState.countdown > 0 && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 my-1">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-300 shrink-0 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-cyan-200 truncate">
                      {postActionState.action.toUpperCase()} ({postActionState.countdown}s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      globalProcessWatcherEngine.cancelPostAction()
                    }}
                    className="px-2 py-0.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 hover:text-white text-[10px] font-bold border border-rose-500/40 transition-transform active:scale-95 shrink-0"
                  >
                    Batal
                  </button>
                </div>
              )}

              {showProcessWatch ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="relative flex-1">
                      <Search className="w-3 h-3 absolute left-2 top-2 text-white/40" />
                      <input
                        type="text"
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        placeholder="Cari PID atau nama..."
                        className="w-full bg-white/10 border border-white/15 rounded-lg pl-7 pr-2 py-1 text-[11px] text-white placeholder-white/40 focus:outline-none focus:border-amber-400 font-mono"
                        autoFocus
                      />
                    </div>
                    <select
                      value={selectedPostAction}
                      onChange={(e) => setSelectedPostAction(e.target.value)}
                      className="bg-white/10 border border-white/15 rounded-lg px-1.5 py-1 text-[10px] text-white font-medium focus:outline-none focus:border-amber-400"
                    >
                      <option value="none" className="bg-[#1a1a1a] text-white">Tanpa Aksi</option>
                      <option value="sleep" className="bg-[#1a1a1a] text-white">Tidur (Sleep)</option>
                      <option value="lock" className="bg-[#1a1a1a] text-white">Kunci (Lock)</option>
                      <option value="shutdown" className="bg-[#1a1a1a] text-white">Matikan</option>
                    </select>
                  </div>

                  <div className="overflow-y-auto max-h-[82px] space-y-1 custom-scrollbar pr-0.5">
                    {processList
                      .filter(
                        (p) =>
                          p.name.toLowerCase().includes(processSearch.toLowerCase()) ||
                          p.pid.toString().includes(processSearch)
                      )
                      .slice(0, 35)
                      .map((p) => (
                        <div
                          key={p.pid}
                          className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="text-[11px] font-mono font-medium text-white/90 truncate max-w-[120px]">
                              {p.name}
                            </span>
                            <span className="text-[9px] font-mono text-white/40">
                              #{p.pid}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleWatchProcess(p.pid, p.name)}
                            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-bold transition-transform active:scale-95 shrink-0"
                          >
                            Watch
                          </button>
                        </div>
                      ))}
                    {processList.length === 0 && (
                      <div className="text-[10px] text-white/40 text-center py-3">
                        Memuat proses...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    onClick={onClose}
                    className="text-3xl font-bold tracking-tight text-white/95 mt-1 font-mono cursor-pointer hover:text-amber-300 transition-colors inline-block"
                    title={t.clickToCollapse}
                  >
                    {timeStr}
                  </div>
                </>
              )}
            </div>

            {/* Active Running Timer Banner if timer is ticking */}
            {!showProcessWatch && isTimerActive && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 my-0.5">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={isTimerRunning ? { rotate: [0, 0, 180, 180, 360] } : { rotate: 0 }}
                    transition={{
                      duration: 5.0,
                      times: [0, 0.38, 0.5, 0.88, 1.0],
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="text-amber-400"
                  >
                    <Hourglass className="w-3.5 h-3.5 fill-amber-400/20" />
                  </motion.div>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {formatTimeDisplay(remainingSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isTimerRunning) {
                        globalTimerEngine.pause()
                      } else {
                        globalTimerEngine.resume()
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium transition-colors"
                  >
                    {isTimerRunning ? t.pause : t.resume}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenTimer()
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold transition-transform active:scale-95"
                  >
                    {t.openTimer}
                  </button>
                </div>
              </div>
            )}

            {/* Active Media Banner & Quick Timer Presets (Hidden when watching process) */}
            {!showProcessWatch && (
              <>
                {isMediaActive && mediaData && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      setHomePage(0)
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer my-0.5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      {mediaData.thumbnailBase64 ? (
                        <img
                          src={mediaData.thumbnailBase64}
                          alt={mediaData.title}
                          className="w-4 h-4 rounded object-cover shrink-0"
                        />
                      ) : (
                        <Music2 className="w-3.5 h-3.5 text-[#1ed760] shrink-0" />
                      )}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                          {mediaData.title}
                        </span>
                        <span className="text-[10px] text-white/50 truncate flex-1">
                          {mediaData.artist}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setHomePage(0)
                      }}
                      className="px-2.5 py-0.5 rounded-lg bg-[#1ed760] hover:bg-[#1ed760]/90 text-black text-[10px] font-bold transition-transform active:scale-95 shrink-0"
                    >
                      {t.openFile}
                    </button>
                  </div>
                )}

                {/* Quick Timer Presets */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                    {t.quickTimer}
                  </span>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      {
                        label: '5m',
                        action: () => {
                          globalTimerEngine.startTimer(5)
                          onClose()
                        },
                      },
                      {
                        label: '15m',
                        action: () => {
                          globalTimerEngine.startTimer(15)
                          onClose()
                        },
                      },
                      {
                        label: '25m',
                        action: () => {
                          globalTimerEngine.startTimer(25)
                          onClose()
                        },
                      },
                      {
                        label: t.focus,
                        action: () => {
                          globalTimerEngine.startPomodoro('focus', 1)
                          onClose()
                        },
                        highlight: true,
                      },
                      {
                        label: t.custom,
                        action: () => setShowCustomInput(!showCustomInput),
                        active: showCustomInput,
                      },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={preset.action}
                        className={`py-1.5 px-1 rounded-xl text-xs font-medium transition-all text-center active:scale-95 ${
                          preset.active
                            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                            : preset.highlight
                            ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {showCustomInput && (
                    <form
                      onSubmit={handleStartCustom}
                      className="flex items-center gap-1.5 mt-1 pt-1 border-t border-white/10"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={customHours}
                          onChange={(e) => handleDurationInput(e.target.value, 99, setCustomHours)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!customHours) setCustomHours('0')
                          }}
                          className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                          placeholder="0"
                        />
                        <span className="text-[11px] text-white/50 font-mono">{t.hourUnit}</span>
                      </div>
                      <span className="text-white/30 text-xs font-mono">:</span>
                      <div className="flex items-center gap-1">
                        <input
                          ref={customMinsInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={customMins}
                          onChange={(e) => handleDurationInput(e.target.value, 59, setCustomMins)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!customMins) setCustomMins('0')
                          }}
                          className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                          placeholder="0"
                        />
                        <span className="text-[11px] text-white/50 font-mono">{t.minUnit}</span>
                      </div>
                      <span className="text-white/30 text-xs font-mono">:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={customSecs}
                          onChange={(e) => handleDurationInput(e.target.value, 59, setCustomSecs)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => {
                            if (!customSecs) setCustomSecs('0')
                          }}
                          className="w-11 bg-white/10 border border-white/20 rounded-lg py-1 text-center text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                          placeholder="0"
                        />
                        <span className="text-[11px] text-white/50 font-mono">{t.secUnit}</span>
                      </div>
                      <button
                        type="submit"
                        className="px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors ml-auto active:scale-95 shadow-sm"
                      >
                        {t.start}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Page 2: Dedicated File Shelf (Kanan) */}
          <div className="w-1/3 h-full px-5 pt-3.5 pb-1 flex flex-col justify-between shrink-0">
            <FileShelf isDragOver={isDragOver} onClose={onClose} />
          </div>
        </motion.div>
      </div>

      {/* Bottom Pagination Dots */}
      <div className="flex items-center justify-center gap-1.5 pb-2 pt-0.5 shrink-0">
        <button
          onClick={() => setHomePage(0)}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            homePage === 0 ? 'w-4 bg-[#1ed760]' : 'w-1.5 bg-white/25 hover:bg-white/50'
          }`}
          aria-label={t.music}
          title={t.music}
        />
        <button
          onClick={() => setHomePage(1)}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            homePage === 1 ? 'w-4 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/50'
          }`}
          aria-label={t.clockAndTimer}
          title={t.clockAndTimer}
        />
        <button
          onClick={() => setHomePage(2)}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            homePage === 2 ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/25 hover:bg-white/50'
          }`}
          aria-label={t.fileShelf}
          title={t.fileShelf}
        />
      </div>
    </div>
  )
}
