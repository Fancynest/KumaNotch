import { useEffect, useRef, useState } from 'react'

export interface FrameStats {
  fps: number
  avgMs: number
  maxMs: number
  longTasks: number
}

export function DevFrameMeter() {
  const [stats, setStats] = useState<FrameStats>({
    fps: 60,
    avgMs: 16.6,
    maxMs: 16.6,
    longTasks: 0,
  })

  const frameTimesRef = useRef<number[]>([])
  const lastTimeRef = useRef<number>(performance.now())
  const longTaskCountRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    // 1. Monitor longtask entries (>50ms) via PerformanceObserver
    let observer: PerformanceObserver | null = null
    try {
      if ('PerformanceObserver' in window) {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              longTaskCountRef.current += 1
              console.warn(`[PERF DEV] LongTask detected: ${entry.duration.toFixed(1)}ms`)
            }
          }
        })
        observer.observe({ entryTypes: ['longtask'] })
      }
    } catch {
      // Ignore if longtask observer unsupported in environment
    }

    // 2. Measure requestAnimationFrame delta
    const measure = (now: number) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      if (delta > 0 && delta < 1000) {
        frameTimesRef.current.push(delta)
        if (frameTimesRef.current.length > 60) {
          frameTimesRef.current.shift()
        }
      }

      rafIdRef.current = requestAnimationFrame(measure)
    }

    rafIdRef.current = requestAnimationFrame(measure)

    // Update stats every 500ms
    const interval = setInterval(() => {
      const times = frameTimesRef.current
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0)
        const avg = sum / times.length
        const max = Math.max(...times)
        const fps = Math.round(1000 / avg)
        setStats({
          fps: Math.min(fps, 144),
          avgMs: Number(avg.toFixed(1)),
          maxMs: Number(max.toFixed(1)),
          longTasks: longTaskCountRef.current,
        })
      }
    }, 500)

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      clearInterval(interval)
      if (observer) observer.disconnect()
    }
  }, [])

  return (
    <div className="fixed bottom-1 right-2 z-50 pointer-events-none text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/80 border border-white/20 text-emerald-400 opacity-70">
      {stats.fps}fps · {stats.avgMs}ms (max {stats.maxMs}ms) · {stats.longTasks}lt
    </div>
  )
}
