import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Terminal, XCircle } from 'lucide-react'
import type { ProcessEvent } from '../../core/processWatcher'
import { MataKuma } from './MataKuma'

interface ProcessNotificationCardProps {
  event: ProcessEvent
  onDismiss?: () => void
}

export const ProcessNotificationCard: React.FC<ProcessNotificationCardProps> = ({
  event,
  onDismiss,
}) => {
  const isRunning = event.status === 'running'
  const isSuccess = event.status === 'success'

  const durationStr =
    event.duration_ms > 0
      ? event.duration_ms >= 1000
        ? `${(event.duration_ms / 1000).toFixed(1)}s`
        : `${event.duration_ms}ms`
      : null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onDismiss}
      className="absolute inset-0 px-3.5 flex items-center justify-between text-white overflow-hidden cursor-pointer select-none"
    >
      {/* Left: Process Icon & Info */}
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
            isRunning
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : isSuccess
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
        >
          {isRunning ? (
            <Terminal className="w-3.5 h-3.5 animate-pulse" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex flex-col min-w-0 justify-center">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-xs font-semibold text-white/95 truncate font-mono tracking-tight">
              {event.command}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 leading-none">
            <span
              className={`text-[10px] font-medium tracking-tight ${
                isRunning
                  ? 'text-amber-300'
                  : isSuccess
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }`}
            >
              {isRunning
                ? 'Running...'
                : isSuccess
                ? 'Selesai'
                : `Gagal (exit ${event.exit_code ?? 1})`}
            </span>

            {durationStr && (
              <>
                <span className="text-[10px] text-white/30">•</span>
                <span className="text-[10px] font-mono text-white/60">
                  {durationStr}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Mata Kuma reacting directly */}
      <div className="shrink-0 flex items-center gap-2.5 pl-1">
        <div
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isRunning
              ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse'
              : isSuccess
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
              : 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]'
          }`}
        />

        <div className="scale-90 origin-right">
          <MataKuma
            isVisible
            emotion={isSuccess ? 'happy' : isRunning ? 'focus' : 'sad'}
          />
        </div>
      </div>
    </motion.div>
  )
}
