import { DuetClient, duetSession, type DuetPlayerInfo, type RoomState } from '../api/duet'
import { loadSongs } from '../songs/repo'
import type { Song } from '../songs/types'
import { store } from '../state/store'
import { mascotSVG, skyDecor } from '../ui/parts'
import { toast } from '../ui/modal'

export function renderDuet(root: HTMLElement, params: URLSearchParams): () => void {
  const profile = store.get().profile!
  let client: DuetClient | null = null
  let handedOff = false // true once we navigate to the sing screen with the session
  let songs: Song[] = []
  const preferredSong = params.get('song')

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen screen--nonav">
    <header class="topbar rise">
      <a class="icon-btn" href="#/songs" aria-label="Go back">←</a>
      <h1 class="title">Duet Time 🎤🎤</h1>
      <span class="spacer"></span>
    </header>
    <div data-stage></div>
  </main>`

  const stage = root.querySelector('[data-stage]') as HTMLElement

  if (!profile.singerId) {
    stage.innerHTML = `
      <div class="coach rise d1">
        ${mascotSVG('mascot mascot-sm')}
        <div class="bubble bubble-left">Duets need a <strong>family profile</strong> so your sister can see your name and sparkles!</div>
      </div>
      <div class="ctas rise d2">
        <a class="btn btn-xl" href="#/profiles">Pick my profile ⭐</a>
      </div>`
    return () => {}
  }

  const me: DuetPlayerInfo = {
    singerId: profile.singerId,
    name: profile.name,
    avatar: profile.avatar,
  }

  function showChoice(): void {
    stage.innerHTML = `
      <div class="coach rise d1">
        ${mascotSVG('mascot mascot-sm')}
        <div class="bubble bubble-left">Sing the same song at the same time — on two devices — and cheer each other on! 💙</div>
      </div>
      <div class="ctas rise d2">
        <button class="btn btn-xl" data-create>Make a room ⭐</button>
        <button class="btn btn-white btn-xl" data-join>Join with a code 🔑</button>
      </div>`

    stage.querySelector('[data-create]')?.addEventListener('click', () => void createRoom())
    stage.querySelector('[data-join]')?.addEventListener('click', showJoin)
  }

  function showJoin(): void {
    stage.innerHTML = `
      <div class="card rise" style="text-align:center">
        <h2 class="display" style="font-size:22px;margin-bottom:12px">Type the room code 🔑</h2>
        <input class="name-input code-input" maxlength="4" autocapitalize="characters"
               placeholder="ABCD" aria-label="Room code">
        <div class="ctas" style="margin-top:18px">
          <button class="btn btn-xl" data-go>Join the duet! 🎤</button>
          <button class="link-quiet" data-back>Back</button>
        </div>
      </div>`
    const input = stage.querySelector('.code-input') as HTMLInputElement
    input.focus()
    stage.querySelector('[data-back]')?.addEventListener('click', showChoice)
    stage.querySelector('[data-go]')?.addEventListener('click', () => void joinRoom(input.value))
  }

  async function ensureClient(): Promise<DuetClient> {
    if (client) return client
    client = await DuetClient.connect()
    return client
  }

  async function createRoom(): Promise<void> {
    try {
      const c = await ensureClient()
      const room = await c.createRoom(me)
      wireRoomEvents(c)
      showLobby(c, room)
    } catch {
      toast("Can't reach the family server 📡", 'pink')
    }
  }

  async function joinRoom(code: string): Promise<void> {
    if (code.trim().length !== 4) {
      toast('Codes have 4 letters!', 'pink')
      return
    }
    try {
      const c = await ensureClient()
      const room = await c.joinRoom(code.trim().toUpperCase(), me)
      wireRoomEvents(c)
      showLobby(c, room)
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      toast(message.includes('found') ? "That code wasn't found — check the letters!" :
            message.includes('two singers') ? 'That room is already full!' :
            "Couldn't join right now 💙", 'pink')
    }
  }

  let lobbyRoom: RoomState | null = null

  function wireRoomEvents(c: DuetClient): void {
    c.onPlayerJoined((p) => {
      if (lobbyRoom && !lobbyRoom.players.some((x) => x.singerId === p.singerId && x.name === p.name)) {
        lobbyRoom.players.push(p)
      }
      toast(`${p.name} is here! 🎉`, 'gold')
      if (lobbyRoom) showLobby(c, lobbyRoom)
    })
    c.onPlayerLeft((p) => {
      if (lobbyRoom) {
        lobbyRoom.players = lobbyRoom.players.filter((x) => !(x.singerId === p.singerId && x.name === p.name))
        toast(`${p.name} left 💙`, 'pink')
        showLobby(c, lobbyRoom)
      }
    })
    c.onSongStarted((songId) => {
      const session = duetSession.get()
      if (!session || !lobbyRoom) return
      session.opponent = lobbyRoom.players.find((p) => p.singerId !== me.singerId || p.name !== me.name) ?? null
      handedOff = true
      location.hash = `#/sing?song=${songId}&duet=1`
    })
  }

  function showLobby(c: DuetClient, room: RoomState): void {
    lobbyRoom = room
    duetSession.set({
      client: c,
      code: room.code,
      me,
      opponent: room.players.find((p) => p.singerId !== me.singerId || p.name !== me.name) ?? null,
      result: null,
      mySummary: null,
    })

    const both = room.players.length === 2
    stage.innerHTML = `
      <div class="card rise" style="text-align:center">
        <p style="font-weight:900;color:var(--ink-soft);letter-spacing:.12em;font-size:12px">ROOM CODE</p>
        <div class="duet-code" aria-label="Room code ${room.code}">${room.code
          .split('')
          .map((ch) => `<span>${ch}</span>`)
          .join('')}</div>
        <p style="font-weight:800;color:var(--ink-soft);font-size:13.5px;margin-top:8px">
          ${both ? 'Everyone is here! 🎉' : 'Tell your duet buddy this code!'}
        </p>
      </div>
      <div class="duet-players rise d1">
        ${room.players
          .map(
            (p) => `
          <div class="profile-card">
            <div class="avatar avatar-lg">${p.avatar}</div>
            <strong>${p.name}</strong>
          </div>`,
          )
          .join('')}
        ${both ? '' : '<div class="profile-card profile-new"><span style="font-size:38px">⏳</span><strong>Waiting…</strong></div>'}
      </div>
      <div class="ctas rise d2" data-song-area></div>`

    if (both) {
      const area = stage.querySelector('[data-song-area]') as HTMLElement
      const options = songs
        .map(
          (s) =>
            `<option value="${s.id}"${s.id === preferredSong ? ' selected' : ''}>${s.emoji} ${s.title}</option>`,
        )
        .join('')
      area.innerHTML = `
        <label style="font-family:var(--font-display);font-weight:700;font-size:17px">Pick the duet song 🎵</label>
        <select class="name-input" data-song style="font-size:18px">${options}</select>
        <button class="btn btn-xl btn-gold" data-start>Start the duet! 🎤🎤</button>`
      area.querySelector('[data-start]')?.addEventListener('click', () => {
        const songId = (area.querySelector('[data-song]') as HTMLSelectElement).value
        void c.startSong(songId).catch(() => toast('Need both singers in the room!', 'pink'))
      })
    }
  }

  void loadSongs().then(({ songs: list, online }) => {
    songs = list
    if (!online) {
      stage.innerHTML = `
        <div class="new-songs" style="margin-top:10px">
          <span class="ico">📡</span>
          Duets need the family server, and it isn't reachable right now.<br>
          <div style="margin-top:14px"><a class="btn btn-sm" href="#/songs">Sing solo instead ▶</a></div>
        </div>`
      return
    }
    showChoice()
  })

  return () => {
    if (!handedOff) void duetSession.end()
  }
}
