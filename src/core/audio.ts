import { invoke } from '@tauri-apps/api/core'

/**
 * Audio synthesis helper using Web Audio API for timer completion chimes.
 * Requires 0 external asset files, operates with zero disk I/O, and produces
 * a warm, resonant, pleasant chime suitable for alerts.
 */

let audioCtx: AudioContext | null = null
let alarmIntervalId: ReturnType<typeof setInterval> | null = null
let alarmAutoStopTimeoutId: ReturnType<typeof setTimeout> | null = null
let isNativeAlarmActive = false
let currentMasterGain: GainNode | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function playTimerChime(volume = 0.85): void {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // Master Gain
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now)
    masterGain.connect(ctx.destination)
    currentMasterGain = masterGain

    // Note 1: C6 (1046.5 Hz) - bright pleasant strike
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(1046.5, now)
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    osc1.connect(gain1)
    gain1.connect(masterGain)
    osc1.start(now)
    osc1.stop(now + 1.25)

    // Note 2: E6 (1318.5 Hz) - delayed harmony (+0.12s)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1318.5, now + 0.12)
    gain2.gain.setValueAtTime(0, now + 0.12)
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.14)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6)
    osc2.connect(gain2)
    gain2.connect(masterGain)
    osc2.start(now + 0.12)
    osc2.stop(now + 1.65)

    // Note 3: G6 (1567.98 Hz) - top sparkle (+0.24s)
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1567.98, now + 0.24)
    gain3.gain.setValueAtTime(0, now + 0.24)
    gain3.gain.linearRampToValueAtTime(0.35, now + 0.26)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.9)
    osc3.connect(gain3)
    gain3.connect(masterGain)
    osc3.start(now + 0.24)
    osc3.stop(now + 1.95)
  } catch (err) {
    console.debug('Audio chime playback fallback:', err)
  }
}

/**
 * Native Windows System Sound (PlaySoundW with SND_SYSTEM) to trigger OS audio ducking.
 */
export async function playNativeAlert(sound = 'alarm'): Promise<boolean> {
  try {
    return await invoke<boolean>('play_system_sound', { sound })
  } catch (err) {
    console.debug('play_system_sound dev fallback:', err)
    return false
  }
}

export async function stopNativeAlert(): Promise<boolean> {
  try {
    return await invoke<boolean>('stop_system_sound')
  } catch (err) {
    console.debug('stop_system_sound dev fallback:', err)
    return false
  }
}

/**
 * Starts repeating alarm sound until stopAlarmLoop() is called or autoStop timeout triggers (30-60s).
 * Default interval: 2.4s between strikes for continuous rhythmic alert.
 * Auto-stops automatically after 45s (clamped to 30-60s) to prevent infinite ringing.
 * Set `useNativeSound = true` to trigger native PlaySoundW with OS-level audio ducking.
 */
export function startAlarmLoop(
  intervalMs = 2400,
  volume = 0.85,
  useNativeSound = false,
  autoStopMs = 45000,
): void {
  stopAlarmLoop()
  isNativeAlarmActive = useNativeSound

  if (useNativeSound) {
    playNativeAlert('alarm')
    alarmIntervalId = setInterval(() => {
      playNativeAlert('alarm')
    }, intervalMs)
  } else {
    playTimerChime(volume)
    alarmIntervalId = setInterval(() => {
      playTimerChime(volume)
    }, intervalMs)
  }

  // Automatically limit alarm duration to 45s (range: 30-60s)
  const clampedTimeout = Math.max(30000, Math.min(60000, autoStopMs))
  alarmAutoStopTimeoutId = setTimeout(() => {
    stopAlarmLoop()
  }, clampedTimeout)
}

/**
 * Stops repeating alarm sound immediately, cancels auto-stop timeout, and fades active gain.
 */
export function stopAlarmLoop(): void {
  if (alarmAutoStopTimeoutId) {
    clearTimeout(alarmAutoStopTimeoutId)
    alarmAutoStopTimeoutId = null
  }
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId)
    alarmIntervalId = null
  }
  if (isNativeAlarmActive) {
    stopNativeAlert()
    isNativeAlarmActive = false
  }
  if (currentMasterGain && audioCtx) {
    try {
      const now = audioCtx.currentTime
      currentMasterGain.gain.cancelScheduledValues(now)
      currentMasterGain.gain.setValueAtTime(currentMasterGain.gain.value, now)
      currentMasterGain.gain.linearRampToValueAtTime(0, now + 0.05)
    } catch {}
    currentMasterGain = null
  }
}

export function isAlarmPlaying(): boolean {
  return alarmIntervalId !== null
}
