import { pitchStrictness, type PitchStrictness } from '../state/scoring'
import { store } from '../state/store'
import { deviceSettings } from '../state/device'
import { describePicker, SYSTEM_DEFAULT_LABEL } from '../audio/microphone'
import { listMicrophones } from '../audio/microphone-access'
import { midiToName } from '../audio/range'
import { showModal } from './modal'
import { showAvatarManager, showSongManager } from './managers'

/** The three pitch strictness levels, gentlest first, as a grown-up reads them. */
const STRICTNESS_CHOICES: readonly { value: PitchStrictness; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'just-right', label: 'Just&nbsp;right' },
  { value: 'precise', label: 'Precise' },
]
const MICROPHONE_HINT = 'A headset works best: it stops the tablet hearing its own melody'

/** The Grown-Ups Corner — reached only through the parent gate. */
export function showSettings(): void {
  const s = store.get()
  const profile = s.profile
  const rangeLabel = profile?.range
    ? `${midiToName(profile.range.low)} – ${midiToName(profile.range.high)}`
    : 'not set yet'
  const strictness = pitchStrictness(profile?.strictness)

  showModal({
    ariaLabel: 'Grown-ups corner',
    html: `
      <span class="modal-emoji" aria-hidden="true">🧑‍🤝‍🧒</span>
      <h3>Grown-Ups Corner</h3>
      <p>Badges & streaks stay on this device. Profiles, songs and family high scores live on
      <strong>your home server only</strong> — and during duets, just live scores are shared. 💙</p>

      <div class="setting-row">
        <span>Mic timing offset<br><small style="color:var(--ink-soft)">If cheers feel late, nudge this</small></span>
        <input type="range" min="-300" max="300" step="10" value="${profile?.latencyMs ?? 0}" data-latency>
        <b data-latency-label>${profile?.latencyMs ?? 0} ms</b>
      </div>
      <div class="setting-row">
        <span>Microphone<br><small style="color:var(--ink-soft)" data-microphone-hint>${MICROPHONE_HINT}</small></span>
        <select class="select select-sm" data-microphone aria-label="Microphone">
          <option value="">${SYSTEM_DEFAULT_LABEL}</option>
        </select>
        <button class="btn btn-sm btn-white" data-microphone-names hidden>Show microphones</button>
      </div>
      <div class="setting-row">
        <span id="strictness-label">Pitch matching<br><small style="color:var(--ink-soft)">How close a note must be to count</small></span>
        <div class="radio-group" role="radiogroup" aria-labelledby="strictness-label" data-strictness>
          ${STRICTNESS_CHOICES.map(
            (c) =>
              `<label class="radio"><input type="radio" name="strictness" value="${c.value}"${c.value === strictness ? ' checked' : ''}><span class="radio-dot" aria-hidden="true"></span><span>${c.label}</span></label>`,
          ).join('')}
        </div>
      </div>
      <div class="setting-row">
        <span>Voice range<br><small style="color:var(--ink-soft)">${rangeLabel}</small></span>
        <a class="btn btn-sm" style="width:auto;margin:0" href="#/voice" data-close-link>Re-do</a>
      </div>

      <div class="setting-row">
        <span>Family content<br><small style="color:var(--ink-soft)">Songs & avatars on the server</small></span>
        <span style="display:flex;gap:8px">
          <button class="btn btn-sm" style="margin:0" data-songs-mgr>🎵 Songs</button>
          <button class="btn btn-sm btn-white" style="margin:0" data-avatars-mgr>😊 Avatars</button>
        </span>
      </div>
      <div class="setting-row">
        <span>Singers<br><small style="color:var(--ink-soft)">Profiles, photos & switching</small></span>
        <a class="btn btn-sm" style="width:auto;margin:0" href="#/profiles" data-close-link2>👨‍👧‍👧 Manage</a>
      </div>

      <button class="btn btn-pink" data-reset>Start everything over 🗑️</button>
      <button class="link-quiet" data-close>Close</button>
    `,
    onMount(modal, close) {
      const slider = modal.querySelector('[data-latency]') as HTMLInputElement
      const label = modal.querySelector('[data-latency-label]') as HTMLElement
      slider.addEventListener('input', () => {
        label.textContent = `${slider.value} ms`
        store.update((st) => {
          if (st.profile) st.profile.latencyMs = Number(slider.value)
        })
      })
      // the choice is saved by the event that makes it: there is no save step
      modal.querySelector('[data-strictness]')?.addEventListener('change', (e) => {
        const chosen = pitchStrictness((e.target as HTMLInputElement).value)
        store.update((st) => {
          if (st.profile) st.profile.strictness = chosen
        })
      })

      // the microphone picker: one choice per device, saved the moment it is picked
      const micSelect = modal.querySelector('[data-microphone]') as HTMLSelectElement
      const renderMicrophones = async (): Promise<void> => {
        const view = describePicker(deviceSettings.getMicrophone(), await listMicrophones())
        micSelect.replaceChildren(...view.options.map((o) => new Option(o.label, o.value)))
        micSelect.value = view.selected
      }
      micSelect.addEventListener('change', () => {
        const picked = micSelect.selectedOptions[0]
        deviceSettings.setMicrophone(
          picked && picked.value !== '' ? { deviceId: picked.value, label: picked.text } : null,
        )
        void renderMicrophones()
      })
      void renderMicrophones()

      modal.querySelector('[data-close]')?.addEventListener('click', close)
      modal.querySelector('[data-close-link]')?.addEventListener('click', close)
      modal.querySelector('[data-close-link2]')?.addEventListener('click', close)
      modal.querySelector('[data-songs-mgr]')?.addEventListener('click', () => {
        close()
        showSongManager()
      })
      modal.querySelector('[data-avatars-mgr]')?.addEventListener('click', () => {
        close()
        showAvatarManager()
      })
      modal.querySelector('[data-reset]')?.addEventListener('click', () => {
        close()
        showModal({
          ariaLabel: 'Confirm reset',
          html: `
            <span class="modal-emoji">🫣</span>
            <h3>Really start over?</h3>
            <p>This erases the profile, sparkles, badges, voice range and microphone choice on this device.</p>
            <button class="btn btn-pink" data-yes>Yes, erase everything</button>
            <button class="link-quiet" data-no>Keep my stuff</button>
          `,
          onMount(m2, close2) {
            m2.querySelector('[data-no]')?.addEventListener('click', close2)
            m2.querySelector('[data-yes]')?.addEventListener('click', () => {
              store.reset()
              deviceSettings.setMicrophone(null)
              close2()
              location.hash = '#/welcome'
            })
          },
        })
      })
    },
  })
}
