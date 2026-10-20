import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

function formatClockTime(now: Date, mode: 'auto' | '12h' | '24h' = 'auto'): string {
  if (mode === '12h') {
    return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (mode === '24h') {
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function useSystemClock(timeFormatSetting: 'auto' | '12h' | '24h', languageSetting: string) {
  const [clockFormat, setClockFormat] = useState<'auto' | '12h' | '24h'>('auto')

  useEffect(() => {
    invoke<string>('get_system_time_format')
      .then((fmt) => {
        if (fmt === '12h' || fmt === '24h') setClockFormat(fmt)
      })
      .catch(() => {})
  }, [])

  const [timeStr, setTimeStr] = useState(() => formatClockTime(new Date(), 'auto'))
  const [dateStr, setDateStr] = useState(() => {
    return new Date().toLocaleDateString(typeof navigator !== 'undefined' ? navigator.language : undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  })

  useEffect(() => {
    const effectiveFormat = timeFormatSetting === 'auto' ? clockFormat : timeFormatSetting
    const updateTime = () => {
      const now = new Date()
      setTimeStr(formatClockTime(now, effectiveFormat))
      const locale =
        languageSetting === 'id'
          ? 'id-ID'
          : languageSetting === 'en'
          ? 'en-US'
          : typeof navigator !== 'undefined'
          ? navigator.language
          : undefined
      setDateStr(
        now.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
      )
    }

    updateTime()
    const now = new Date()
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()

    let intervalId: ReturnType<typeof setInterval>
    const timeoutId = setTimeout(() => {
      updateTime()
      intervalId = setInterval(updateTime, 60000)
    }, msToNextMinute)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [clockFormat, timeFormatSetting, languageSetting])

  return { timeStr, dateStr, clockFormat }
}
