import { useState, useEffect, useRef, useCallback } from 'react'
import { setIslandOffset } from '../core/windowSizing'
import { globalSettingsEngine } from '../core/settings'
import type { IslandView } from '../core/islandStore'

interface UseIslandDragOptions {
  currentView: IslandView
  initialOffset?: number
  isBrowserDev: boolean
  onExpandHome: (page: number) => void
}

export function useIslandDrag({
  currentView,
  initialOffset = 0,
  isBrowserDev,
  onExpandHome,
}: UseIslandDragOptions) {
  const [horizontalOffset, setHorizontalOffset] = useState<number>(initialOffset)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isMagnetSnapped, setIsMagnetSnapped] = useState<boolean>(false)

  const dragRef = useRef<{ startScreenX: number; startOffset: number; hasMoved: boolean } | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const lastDragEndTimeRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const pendingOffsetRef = useRef<number | null>(null)

  useEffect(() => {
    if (initialOffset !== undefined && initialOffset !== 0) {
      setIslandOffset(initialOffset)
    }
  }, [initialOffset])

  const endDrag = useCallback(
    (screenX: number) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (!dragRef.current) {
        setIsDragging(false)
        isDraggingRef.current = false
        return
      }
      const deltaX = screenX - dragRef.current.startScreenX
      const hadMoved = dragRef.current.hasMoved
      const startOffset = dragRef.current.startOffset
      dragRef.current = null

      if (hadMoved) {
        lastDragEndTimeRef.current = Date.now()
        isDraggingRef.current = true

        const rawCandidate = startOffset + deltaX
        const SNAP_RADIUS = 85

        if (Math.abs(rawCandidate) <= SNAP_RADIUS) {
          setHorizontalOffset(0)
          setIslandOffset(0)
          globalSettingsEngine.update({ horizontalOffset: 0 })

          // If pulled/snapped into center from outside: TRIGGER SURPRISE REACTION!
          if (Math.abs(startOffset) > 15 || Math.abs(rawCandidate) > 15) {
            setIsMagnetSnapped(true)
            setTimeout(() => setIsMagnetSnapped(false), 2600)
          }
        } else {
          setHorizontalOffset(rawCandidate)
          setIslandOffset(rawCandidate)
          globalSettingsEngine.update({ horizontalOffset: rawCandidate })
        }

        // Suppress dragging flag after 500ms to guarantee any subsequent click event is dropped
        setTimeout(() => {
          setIsDragging(false)
          isDraggingRef.current = false
        }, 500)
      } else {
        setIsDragging(false)
        isDraggingRef.current = false
      }
    },
    [],
  )

  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (dragRef.current) {
        endDrag(e.screenX)
      }
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
    }
  }, [endDrag])

  const handleShellPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only allow island dragging when in idle capsule view
      if (currentView !== 'idle') return
      const target = e.target as HTMLElement
      if (target.closest('button, input, select, textarea, [data-no-drag]')) return

      dragRef.current = {
        startScreenX: e.screenX,
        startOffset: horizontalOffset,
        hasMoved: false,
      }
      isDraggingRef.current = false
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {}
    },
    [currentView, horizontalOffset],
  )

  const handleShellPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (currentView !== 'idle' || !dragRef.current) return
      const deltaX = e.screenX - dragRef.current.startScreenX
      if (!dragRef.current.hasMoved) {
        if (Math.abs(deltaX) >= 5) {
          dragRef.current.hasMoved = true
          isDraggingRef.current = true
          setIsDragging(true)
        } else {
          return
        }
      }

      const rawCandidate = dragRef.current.startOffset + deltaX
      const SNAP_RADIUS = 85
      const targetOffset = Math.abs(rawCandidate) <= SNAP_RADIUS ? 0 : rawCandidate

      pendingOffsetRef.current = targetOffset
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (pendingOffsetRef.current !== null) {
            setIslandOffset(pendingOffsetRef.current)
            if (isBrowserDev) setHorizontalOffset(pendingOffsetRef.current)
          }
        })
      }
    },
    [currentView, isBrowserDev],
  )

  const handleShellPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
      endDrag(e.screenX)
    },
    [endDrag],
  )

  const handleShellPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
      endDrag(e.screenX)
    },
    [endDrag],
  )

  const handleShellDoubleClick = useCallback(() => {
    if (currentView !== 'idle') return
    if (horizontalOffset !== 0) {
      setHorizontalOffset(0)
      setIslandOffset(0)
      globalSettingsEngine.update({ horizontalOffset: 0 })
      setIsMagnetSnapped(true)
      setTimeout(() => setIsMagnetSnapped(false), 2600)
    }
  }, [currentView, horizontalOffset])

  const handleShellClick = useCallback(
    (e?: React.MouseEvent) => {
      // If we were dragging or just finished dragging (< 500ms), DO NOT EXPAND!
      if (
        isDragging ||
        isDraggingRef.current ||
        Date.now() - lastDragEndTimeRef.current < 500
      ) {
        if (e) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      if (currentView === 'idle') {
        onExpandHome(1)
      } else if (currentView === 'dropTarget') {
        onExpandHome(2)
      }
    },
    [isDragging, currentView, onExpandHome],
  )

  return {
    horizontalOffset,
    setHorizontalOffset,
    isDragging,
    isMagnetSnapped,
    setIsMagnetSnapped,
    handleShellPointerDown,
    handleShellPointerMove,
    handleShellPointerUp,
    handleShellPointerCancel,
    handleShellDoubleClick,
    handleShellClick,
  }
}
