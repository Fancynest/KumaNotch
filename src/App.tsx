import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Timer as TimerIcon,
  Music,
} from 'lucide-react'

// Authentic Apple Dynamic Island spring transition curve
const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
}

export default function App() {
  // Activity states
  const [musicActive, setMusicActive] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTrackTime, setCurrentTrackTime] = useState(78) // in seconds (01:18)
  const trackDuration = 214 // 03:34

  const [timerActive, setTimerActive] = useState(true)
  const [timerRunning, setTimerRunning] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(14 * 60 + 52) // 14:52

  // Expanded focus state: null (compact), 'music', or 'timer'
  const [expandedActivity, setExpandedActivity] = useState<'music' | 'timer' | null>(null)

  // Dev bar toggle
  const [showDevControls, setShowDevControls] = useState(true)

  // Handle Mouse Pass-Through for Electron transparent window
  const islandRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    window.electronAPI?.setIgnoreMouseEvents(false)
  }

  const handleMouseLeave = () => {
    if (!expandedActivity) {
      window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
    }
  }

  // Timer countdown effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (timerActive && timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerActive, timerRunning, timerSeconds])

  // Music progress effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (musicActive && isPlaying) {
      interval = setInterval(() => {
        setCurrentTrackTime((prev) => (prev < trackDuration ? prev + 1 : 0))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [musicActive, isPlaying, trackDuration])

  // Format time helpers
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Determine layout mode:
  const isSplit = musicActive && timerActive && !expandedActivity

  return (
    <div
      className="w-full h-full flex flex-col items-center pt-2 select-none relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dynamic Island Container */}
      <div ref={islandRef} className="relative z-50 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {/* 1. EXPANDED MUSIC VIEW */}
          {expandedActivity === 'music' && (
            <motion.div
              key="expanded-music"
              layoutId="island-music"
              transition={springTransition}
              className="bg-black text-white rounded-[38px] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] border border-white/10 w-[380px] flex flex-col gap-3.5 backdrop-blur-xl"
            >
              {/* Top Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Album Cover Art */}
                  <div className="w-13 h-13 rounded-2xl overflow-hidden shadow-md relative bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center">
                    <Music className="w-6 h-6 text-white/90 drop-shadow" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm tracking-tight text-white/95">
                      Paper Sky
                    </h3>
                    <p className="text-xs text-white/50 font-medium">Lumen Coast</p>
                  </div>
                </div>

                {/* Animated Waveform */}
                <div className="flex items-center gap-1 h-4 px-2">
                  {[40, 90, 60, 100, 30].map((h, i) => (
                    <motion.span
                      key={i}
                      animate={{
                        height: isPlaying ? [`${h * 0.3}%`, `${h}%`, `${h * 0.4}%`] : '30%',
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8 + i * 0.15,
                        ease: 'easeInOut',
                      }}
                      className="w-[3px] bg-[#34c759] rounded-full inline-block"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Progress Slider */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden relative">
                  <motion.div
                    className="bg-white h-full rounded-full"
                    style={{ width: `${(currentTrackTime / trackDuration) * 100}%` }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-white/40 font-mono">
                  <span>{formatTime(currentTrackTime)}</span>
                  <span>-{formatTime(trackDuration - currentTrackTime)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-1 px-4">
                <button
                  onClick={() => setCurrentTrackTime(Math.max(0, currentTrackTime - 10))}
                  className="text-white/70 hover:text-white transition-transform active:scale-90"
                >
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-90 shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() =>
                    setCurrentTrackTime(Math.min(trackDuration, currentTrackTime + 10))
                  }
                  className="text-white/70 hover:text-white transition-transform active:scale-90"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
                <button
                  onClick={() => setExpandedActivity(null)}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* 2. EXPANDED TIMER VIEW */}
          {expandedActivity === 'timer' && (
            <motion.div
              key="expanded-timer"
              layoutId="island-timer"
              transition={springTransition}
              className="bg-black text-white rounded-[38px] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] border border-white/10 w-[330px] flex flex-col gap-4 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#ff9500]/20 flex items-center justify-center">
                    <TimerIcon className="w-4 h-4 text-[#ff9500]" />
                  </div>
                  <span className="text-xs font-semibold tracking-wide text-white/70 uppercase">
                    Focus Timer
                  </span>
                </div>
                <button
                  onClick={() => setExpandedActivity(null)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Countdown Digits */}
              <div className="flex items-center justify-center py-2">
                <div className="text-4xl font-semibold tracking-tight font-mono text-white">
                  {formatTime(timerSeconds)}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setTimerSeconds(15 * 60)}
                  className="w-10 h-10 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-transform active:scale-90"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className="px-6 h-10 rounded-full bg-[#ff9500] text-black font-semibold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-[#ff9500]/30"
                >
                  {timerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{timerRunning ? 'Pause' : 'Start'}</span>
                </button>
                <button
                  onClick={() => setTimerSeconds((prev) => prev + 60)}
                  className="w-10 h-10 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-transform active:scale-90 font-mono text-xs font-bold"
                >
                  +1m
                </button>
              </div>
            </motion.div>
          )}

          {/* 3. SPLIT ISLAND MODE (DUAL CONCURRENT TASKS!) */}
          {isSplit && (
            <div key="split-island" className="flex items-center gap-3">
              {/* Primary Island Capsule (Music) */}
              <motion.div
                layoutId="island-music"
                onClick={() => setExpandedActivity('music')}
                transition={springTransition}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="bg-black text-white h-9 px-3 rounded-full flex items-center gap-2.5 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.6)] border border-white/10"
              >
                {/* Mini Art */}
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <Music className="w-3 h-3 text-white" />
                </div>

                {/* Animated Waveform */}
                <div className="flex items-center gap-0.5 h-3">
                  {[40, 90, 60, 100].map((h, i) => (
                    <motion.span
                      key={i}
                      animate={{
                        height: isPlaying ? [`${h * 0.3}%`, `${h}%`, `${h * 0.4}%`] : '30%',
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.7 + i * 0.15,
                        ease: 'easeInOut',
                      }}
                      className="w-[2.5px] bg-[#34c759] rounded-full inline-block"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Secondary Island Bubble (Timer) */}
              <motion.div
                layoutId="island-timer"
                onClick={() => setExpandedActivity('timer')}
                transition={springTransition}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-black text-[#ff9500] h-9 px-3 rounded-full flex items-center gap-1.5 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.6)] border border-white/10"
              >
                <TimerIcon className="w-3.5 h-3.5 text-[#ff9500]" />
                <span className="text-xs font-mono font-medium text-white/90 tracking-tight">
                  {formatTime(timerSeconds)}
                </span>
              </motion.div>
            </div>
          )}

          {/* 4. SINGLE TASK - MUSIC ONLY */}
          {!isSplit && musicActive && !timerActive && !expandedActivity && (
            <motion.div
              key="single-music"
              layoutId="island-music"
              onClick={() => setExpandedActivity('music')}
              transition={springTransition}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-black text-white h-9 px-3.5 rounded-full flex items-center gap-3 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.6)] border border-white/10"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                <Music className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium text-white/90 max-w-[130px] truncate">
                Paper Sky • Lumen Coast
              </span>
              <div className="flex items-center gap-0.5 h-3">
                {[40, 90, 60, 100].map((h, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      height: isPlaying ? [`${h * 0.3}%`, `${h}%`, `${h * 0.4}%`] : '30%',
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.7 + i * 0.15,
                      ease: 'easeInOut',
                    }}
                    className="w-[2.5px] bg-[#34c759] rounded-full inline-block"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 5. SINGLE TASK - TIMER ONLY */}
          {!isSplit && !musicActive && timerActive && !expandedActivity && (
            <motion.div
              key="single-timer"
              layoutId="island-timer"
              onClick={() => setExpandedActivity('timer')}
              transition={springTransition}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-black text-white h-9 px-4 rounded-full flex items-center gap-2.5 cursor-pointer shadow-[0_6px_20px_rgba(0,0,0,0.6)] border border-white/10"
            >
              <TimerIcon className="w-4 h-4 text-[#ff9500]" />
              <span className="text-xs font-mono font-medium text-white tracking-tight">
                {formatTime(timerSeconds)}
              </span>
            </motion.div>
          )}

          {/* 6. IDLE STATE (Tiny Discreet Capsule with Kuma companion eyes) */}
          {!musicActive && !timerActive && !expandedActivity && (
            <motion.div
              key="idle-capsule"
              layoutId="island-idle"
              transition={springTransition}
              whileHover={{ scale: 1.06 }}
              className="bg-black text-white h-8 w-28 rounded-full flex items-center justify-center gap-3 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10"
            >
              {/* Cute Kuma Blinking Eyes */}
              <motion.span
                animate={{ scaleY: [1, 1, 0.1, 1] }}
                transition={{ repeat: Infinity, duration: 4, times: [0, 0.85, 0.9, 1] }}
                className="w-1.5 h-2 bg-white/90 rounded-full inline-block"
              />
              <motion.span
                animate={{ scaleY: [1, 1, 0.1, 1] }}
                transition={{ repeat: Infinity, duration: 4, times: [0, 0.85, 0.9, 1] }}
                className="w-1.5 h-2 bg-white/90 rounded-full inline-block"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Testing Controller Bar (floating discreetly at bottom) */}
      <div className="mt-auto mb-2 flex flex-col items-center gap-1 z-40">
        <button
          onClick={() => setShowDevControls(!showDevControls)}
          className="text-[10px] text-white/40 hover:text-white/80 bg-black/60 px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1 backdrop-blur-md transition-all"
        >
          <SlidersHorizontal className="w-2.5 h-2.5" />
          <span>{showDevControls ? 'Hide Controls' : 'Show Controls'}</span>
        </button>

        {showDevControls && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full text-xs text-white/80 shadow-lg"
          >
            <button
              onClick={() => {
                setMusicActive(!musicActive)
                setExpandedActivity(null)
              }}
              className={`px-2 py-1 rounded-full transition-all ${
                musicActive ? 'bg-[#34c759]/20 text-[#34c759] font-medium' : 'text-white/40'
              }`}
            >
              🎵 Music {musicActive ? 'ON' : 'OFF'}
            </button>
            <span className="text-white/20">|</span>
            <button
              onClick={() => {
                setTimerActive(!timerActive)
                setExpandedActivity(null)
              }}
              className={`px-2 py-1 rounded-full transition-all ${
                timerActive ? 'bg-[#ff9500]/20 text-[#ff9500] font-medium' : 'text-white/40'
              }`}
            >
              ⏱ Timer {timerActive ? 'ON' : 'OFF'}
            </button>
            <span className="text-white/20">|</span>
            <button
              onClick={() => {
                setMusicActive(true)
                setTimerActive(true)
                setExpandedActivity(null)
              }}
              className={`px-2 py-1 rounded-full transition-all ${
                isSplit ? 'bg-white text-black font-semibold' : 'text-white/50 hover:text-white'
              }`}
            >
              Split Island ✨
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
