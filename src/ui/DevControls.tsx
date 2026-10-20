import React from 'react'
import { Sparkles } from 'lucide-react'
import { globalTimerEngine } from '../core/timer'
import { globalAudioDeviceEngine } from '../core/audioDevice'
import { globalMediaEngine } from '../core/media'
import { globalProcessWatcherEngine } from '../core/processWatcher'

interface DevControlsProps {
  onClose: () => void
  onSetHorizontalOffset: (offset: number) => void
  onTriggerSnap: () => void
}

const DevControlsComponent: React.FC<DevControlsProps> = ({
  onClose,
  onSetHorizontalOffset,
  onTriggerSnap,
}) => {
  return (
    <div className="absolute bottom-2 z-50 flex items-center gap-1.5 bg-black/90 border border-white/15 px-3 py-1 rounded-full text-[11px] text-white/80 shadow-lg">
      <Sparkles className="w-3 h-3 text-amber-400" />
      <button
        onClick={() => globalTimerEngine.startTimer(5)}
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
      >
        Start 5m
      </button>
      <button
        onClick={() => globalTimerEngine.reset()}
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20"
      >
        Stop
      </button>
      <button
        onClick={() =>
          globalAudioDeviceEngine.simulate({
            event_type: 'connected',
            device_name: 'OPPO Enco Buds3',
            device_type: 'tws',
            is_bluetooth: true,
            is_default: true,
          })
        }
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-400"
      >
        TWS
      </button>
      <button
        onClick={() =>
          globalAudioDeviceEngine.simulate({
            event_type: 'connected',
            device_name: 'Sony WH-1000XM5',
            device_type: 'headphones',
            is_bluetooth: true,
            is_default: true,
          })
        }
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-400"
      >
        Headphones
      </button>
      <button
        onClick={() =>
          globalAudioDeviceEngine.simulate({
            event_type: 'connected',
            device_name: 'JBL Flip 6',
            device_type: 'speaker',
            is_bluetooth: true,
            is_default: true,
          })
        }
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-400"
      >
        Speaker
      </button>
      <button
        onClick={() =>
          globalAudioDeviceEngine.simulate({
            event_type: 'connected',
            device_name: 'Keychron K2',
            device_type: 'keyboard',
            is_bluetooth: true,
            is_default: false,
          })
        }
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-400"
      >
        Keyboard
      </button>
      <button
        onClick={() =>
          globalAudioDeviceEngine.simulate({
            event_type: 'connected',
            device_name: 'MX Master 3S',
            device_type: 'mouse',
            is_bluetooth: true,
            is_default: false,
          })
        }
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-sky-400"
      >
        Mouse
      </button>
      <button
        onClick={() =>
          globalMediaEngine.simulate({
            isActive: true,
            title: 'vampire',
            artist: 'Olivia Rodrigo',
            album: 'GUTS',
            playbackStatus: 'playing',
          })
        }
        className="px-1.5 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-400/60 text-purple-300 font-medium"
        title="Simulate playing Olivia Rodrigo - vampire"
      >
        💜 Olivia
      </button>
      <button
        onClick={() => globalProcessWatcherEngine.runCommand('npm run build')}
        className="px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-400/60 text-amber-300 font-medium font-mono text-[10px]"
        title="Simulate kuma run npm run build"
      >
        ⚡ kuma run
      </button>
      <button
        onClick={() =>
          globalProcessWatcherEngine.handleEvent({
            id: `mock-err-${Date.now()}`,
            command: 'cargo test',
            status: 'error',
            exit_code: 1,
            duration_ms: 3120,
            message: 'Process exited with error code 1',
          })
        }
        className="px-1.5 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-400/60 text-rose-300 font-medium font-mono text-[10px]"
        title="Simulate kuma process error"
      >
        ❌ kuma err
      </button>
      <button
        onClick={() =>
          globalProcessWatcherEngine.handleEvent({
            id: `mock-post-${Date.now()}`,
            command: 'kuma run --post-action sleep train.py',
            status: 'success',
            exit_code: 0,
            duration_ms: 12450,
            post_action: 'sleep',
          })
        }
        className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-300 font-medium font-mono text-[10px]"
        title="Simulate process with post-action countdown"
      >
        💤 post-act
      </button>
      <button
        onClick={() => onSetHorizontalOffset(120)}
        className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 font-mono text-[10px]"
        title="Shift island +120px right"
      >
        ➡️ +120
      </button>
      <button
        onClick={onTriggerSnap}
        className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-mono text-[10px] font-bold"
        title="Snap to center with surprised reaction"
      >
        🧲 Snap
      </button>
      <button
        onClick={onClose}
        className="text-white/40 hover:text-white ml-1"
      >
        ✕
      </button>
    </div>
  )
}

export const DevControls = React.memo(DevControlsComponent)
