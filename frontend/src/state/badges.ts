import type { SongSummary } from './scoring'

export interface BadgeMeta {
  id: string
  name: string
  emoji: string
  hint: string
}

export const BADGES: BadgeMeta[] = [
  { id: 'first-song', name: 'First Song', emoji: '🎤', hint: 'Sing your very first song' },
  { id: 'streak-3', name: '3-Day Streak', emoji: '🔥', hint: 'Sing three days in a row' },
  { id: 'high-note-hero', name: 'High Note Hero', emoji: '🚀', hint: 'Land the highest notes of a song' },
  { id: 'show-stopper', name: 'Show Stopper', emoji: '🎭', hint: 'Earn three stars on any song' },
  { id: 'brave-bird', name: 'Brave Bird', emoji: '🐦', hint: 'Finish a Brave (3-star difficulty) song' },
  { id: 'perfect-ten', name: 'Perfect Ten', emoji: '🔟', hint: 'Land ten notes in a row' },
]

export const badgeById = (id: string): BadgeMeta | undefined => BADGES.find((b) => b.id === id)

export interface BadgeContext {
  totalPlays: number
  streak: number
  summary: SongSummary
  songDifficulty: 1 | 2 | 3
  earned: ReadonlySet<string>
}

/** Returns ids of badges newly earned by this play. */
export function evaluateBadges(ctx: BadgeContext): string[] {
  const fresh: string[] = []
  const award = (id: string, ok: boolean) => {
    if (ok && !ctx.earned.has(id)) fresh.push(id)
  }
  const scored = !ctx.summary.noMic && ctx.summary.total > 0

  award('first-song', ctx.totalPlays >= 1)
  award('streak-3', ctx.streak >= 3)
  award('high-note-hero', scored && ctx.summary.braveStars === 3 && ctx.summary.accuracy >= 0.5)
  award('show-stopper', scored && ctx.summary.stars === 3)
  award('brave-bird', ctx.songDifficulty === 3)
  award('perfect-ten', scored && ctx.summary.maxStreak >= 10)
  return fresh
}
