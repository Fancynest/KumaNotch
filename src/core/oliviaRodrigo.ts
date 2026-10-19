import type { MediaData } from './media'

/**
 * Returns true if the currently active media track is by the user's configured favorite artist,
 * or matches the built-in Olivia Rodrigo Easter egg.
 * Checks artist, title, and album fields.
 */
export function isFavoriteArtistMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  if (!media || !media.isActive || media.playbackStatus !== 'playing') {
    return false
  }

  const rawTarget = (favoriteArtist || '').trim().toLowerCase()
  const targets = rawTarget
    ? rawTarget
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : []

  // Built-in Easter egg: Olivia Rodrigo is always recognized!
  if (!targets.some((t) => t.includes('olivia'))) {
    targets.push('olivia rodrigo', 'olivia')
  }

  const artist = (media.artist || '').trim().toLowerCase()
  const title = (media.title || '').trim().toLowerCase()
  const album = (media.album || '').trim().toLowerCase()

  return targets.some((t) => artist.includes(t) || title.includes(t) || album.includes(t))
}

/**
 * Backward-compatible helper for legacy references.
 */
export function isOliviaRodrigoMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  return isFavoriteArtistMedia(media, favoriteArtist || 'olivia rodrigo')
}

