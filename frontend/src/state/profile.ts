import { api, type ApiSinger } from '../api/client'
import { adoptLegacyState, profileKey, setActiveSingerId, store } from './store'

/** Merge the server's view of a singer into the active local profile blob. */
export function applySingerToProfile(s: ApiSinger): void {
  store.update((st) => {
    const prev = st.profile
    st.profile = {
      name: s.name,
      avatar: s.avatarEmoji ?? prev?.avatar ?? '🦄',
      range:
        s.rangeLow !== null && s.rangeHigh !== null
          ? { low: s.rangeLow, high: s.rangeHigh }
          : (prev?.range ?? null),
      latencyMs: prev?.latencyMs ?? 0,
      singerId: s.id,
      avatarId: s.avatarId,
      photoUrl: s.hasPhoto ? api.singers.photoUrl(s.id) : null,
    }
  })
}

/** Switch the whole app to this singer: storage namespace + profile fields. */
export function activateSinger(s: ApiSinger): void {
  adoptLegacyState(s.id)
  setActiveSingerId(s.id)
  store.switchKey(profileKey(s.id))
  applySingerToProfile(s)
}

/** Push the local range/name/avatar back to the server (fire-and-forget when offline). */
export async function pushProfileToServer(): Promise<void> {
  const p = store.get().profile
  if (!p?.singerId) return
  try {
    await api.singers.update(p.singerId, {
      name: p.name,
      avatarId: p.avatarId ?? null,
      rangeLow: p.range?.low ?? null,
      rangeHigh: p.range?.high ?? null,
    })
  } catch {
    /* offline — the server copy catches up next time */
  }
}
