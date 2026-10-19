import type { MediaData } from './media'

/**
 * Returns true if the currently active media track is by the user's configured favorite artist.
 * Matches ARTIST name only. Track titles and album names are strictly ignored.
 * If favoriteArtist is empty or unset, returns false.
 */
export function isFavoriteArtistMedia(
  media: MediaData | null | undefined,
  favoriteArtist?: string
): boolean {
  if (!media || !media.isActive || media.playbackStatus !== 'playing') {
    return false
  }

  const target = (favoriteArtist || '').trim().toLowerCase()
  if (!target) {
    return false
  }

  const artist = (media.artist || '').trim().toLowerCase()
  return artist.includes(target)
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
