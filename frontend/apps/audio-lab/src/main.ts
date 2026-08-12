import {
  PitchTracker,
  audioCtx,
  midiToHz,
  midiToName,
  playNote,
  type PitchFrame,
} from '@twinkletune/audio-engine'
import './styles.css'

/* Pass rules mirror docs/audio-engine-device-test-plan.html: exact note AND
   octave, within ±25 cents, from a steady window after the attack. */
const PASS_CENTS = 25
const SETTLE_MS = 300
const LISTEN_MS = 2000
const SWEEP_GAP_MS = 2000
const MIN_FRAMES = 12

/** Result codes from the device test plan's scoring grid. */
type Code = 'P' | 'O' | 'N' | '—' | '~'

interface Verdict {
  code: Code
  /** median detected MIDI over the listen window, null when nothing was heard */
  median: number | null
  /** signed cents error vs the played note, null when nothing was heard */
  cents: number | null
}

const CODE_LABEL: Record<Code, string> = {
  P: '✓ pass',
  O: '✗ wrong octave',
  N: '✗ wrong note',
  '—': '– no reading',
  '~': '~ unstable',
}
const CODE_CLASS: Record<Code, string> = { P: 'ok', O: 'bad', N: 'bad', '—': 'warn', '~': 'warn' }

/** The device test plan's reference sweep: C3 G3 C4 E4 A4 C5 C6. */
const REFERENCE_TONES = [48, 55, 60, 64, 69, 72, 84]
const WHITE_KEYS = [60, 62, 64, 65, 67, 69, 71, 72]
const BLACK_KEYS = [
  { midi: 61, after: 0 },
  { midi: 63, after: 1 },
  { midi: 66, after: 3 },
  { midi: 68, after: 4 },
  { midi: 70, after: 5 },
]

const app = document.getElementById('app') as HTMLElement
app.innerHTML = `
<main class="lab">
  <header>
    <h1>🎹 TwinkleTune Audio Lab</h1>
    <p class="sub">Speaker → air → microphone → PitchTracker loopback check.
    Quiet room, volume at 60–70%, no Bluetooth audio.</p>
  </header>

  <section class="card controls">
    <button class="btn" data-mic>🎤 Start listening</button>
    <label class="wave">tone
      <select data-wave>
        <option value="sine" selected>sine</option>
        <option value="triangle">triangle</option>
      </select>
    </label>
    <button class="btn ghost" data-rec>⏺ Record diagnostics</button>
    <span class="status" data-status>mic off</span>
  </section>

  <section class="card readout">
    <div class="note" data-note>—</div>
    <div class="meta">
      <span data-hz>– Hz</span>
      <span data-cents>– ¢</span>
      <span data-clarity>clarity –</span>
      <span data-rms>rms –</span>
    </div>
    <div class="rms-track"><div class="rms-bar" data-rms-bar></div></div>
  </section>

  <section class="card">
    <h2>Play a note</h2>
    <p class="hint">Tap a key: the engine plays the note through the speaker and checks
    it hears the same note back (±${PASS_CENTS}¢, octave-exact).</p>
    <div class="piano" data-piano>
      ${WHITE_KEYS.map(
        (m, i) =>
          `<button class="key white" data-key="${m}" style="left:${i * 12.5}%"><span>${midiToName(m)}</span></button>`,
      ).join('')}
      ${BLACK_KEYS.map(
        ({ midi, after }) =>
          `<button class="key black" data-key="${midi}" style="left:${(after + 1) * 12.5 - 4}%" aria-label="${midiToName(midi)}"></button>`,
      ).join('')}
    </div>
    <div class="verdict" data-verdict>Start the mic, then tap a key.</div>
  </section>

  <section class="card">
    <h2>Reference sweep</h2>
    <p class="hint">The 7 tones from the device test plan, spanning the app's authored
    range (C3–C6).</p>
    <table class="sweep">
      <thead><tr><th>Tone</th><th>Target</th><th></th><th>Result</th><th>Heard</th></tr></thead>
      <tbody>
        ${REFERENCE_TONES.map(
          (m) => `<tr data-row="${m}">
          <td>${midiToName(m)}</td>
          <td>${midiToHz(m).toFixed(2)} Hz</td>
          <td><button class="btn small" data-tone="${m}">▶</button></td>
          <td data-result>–</td>
          <td data-heard>–</td>
        </tr>`,
        ).join('')}
      </tbody>
    </table>
    <button class="btn" data-sweep>Run full sweep</button>
  </section>
</main>`

const micBtn = app.querySelector('[data-mic]') as HTMLButtonElement
const waveSel = app.querySelector('[data-wave]') as HTMLSelectElement
const recBtn = app.querySelector('[data-rec]') as HTMLButtonElement
const statusEl = app.querySelector('[data-status]') as HTMLElement
const noteEl = app.querySelector('[data-note]') as HTMLElement
const hzEl = app.querySelector('[data-hz]') as HTMLElement
const centsEl = app.querySelector('[data-cents]') as HTMLElement
const clarityEl = app.querySelector('[data-clarity]') as HTMLElement
const rmsEl = app.querySelector('[data-rms]') as HTMLElement
const rmsBar = app.querySelector('[data-rms-bar]') as HTMLElement
const verdictEl = app.querySelector('[data-verdict]') as HTMLElement
const sweepBtn = app.querySelector('[data-sweep]') as HTMLButtonElement

const tracker = new PitchTracker()
let raf = 0
let busy = false
let collector: PitchFrame[] | null = null
let recording = false
let recordStart = 0
let rows: string[] = []

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const fmtCents = (c: number) => `${c >= 0 ? '+' : ''}${c.toFixed(0)}¢`

function loop(): void {
  raf = requestAnimationFrame(loop)
  const f = tracker.read()
  if (f) {
    collector?.push(f)
    if (recording)
      rows.push(
        `${(performance.now() - recordStart).toFixed(0)},${f.hz.toFixed(2)},${f.midi.toFixed(3)},${f.clarity.toFixed(3)},${f.rms.toFixed(4)}`,
      )
    const nearest = Math.round(f.midi)
    const cents = (f.midi - nearest) * 100
    noteEl.textContent = midiToName(nearest)
    hzEl.textContent = `${f.hz.toFixed(1)} Hz`
    centsEl.textContent = fmtCents(cents)
    clarityEl.textContent = `clarity ${(f.clarity * 100).toFixed(0)}%`
    rmsEl.textContent = `rms ${f.rms.toFixed(3)}`
    rmsBar.style.width = `${Math.min(100, f.rms * 400)}%`
  } else {
    noteEl.textContent = '—'
    rmsBar.style.width = '0%'
  }
}

function micStatus(): string {
  const s = tracker.trackSettings
  const sr = audioCtx().sampleRate
  if (!s) return `${sr} Hz`
  const flag = (v: boolean | undefined) => (v === undefined ? '?' : v ? 'ON' : 'off')
  return `${sr} Hz · echo ${flag(s.echoCancellation)} · noise ${flag(s.noiseSuppression)} · AGC ${flag(s.autoGainControl)}`
}

async function ensureMic(): Promise<boolean> {
  if (tracker.running) return true
  try {
    await tracker.start()
  } catch {
    statusEl.textContent = 'mic access denied — allow the microphone and try again'
    return false
  }
  micBtn.textContent = '⏹ Stop listening'
  statusEl.textContent = micStatus()
  loop()
  return true
}

function stopMic(): void {
  if (recording) finishRecording()
  cancelAnimationFrame(raf)
  tracker.stop()
  micBtn.textContent = '🎤 Start listening'
  statusEl.textContent = 'mic off'
  noteEl.textContent = '—'
  rmsBar.style.width = '0%'
}

/** Play the target, skip the attack, then judge the steady listen window. */
async function verify(target: number): Promise<Verdict> {
  playNote(target, (SETTLE_MS + LISTEN_MS) / 1000 + 0.2, waveSel.value as OscillatorType)
  await sleep(SETTLE_MS)
  const frames: PitchFrame[] = []
  collector = frames
  await sleep(LISTEN_MS)
  collector = null
  return classify(target, frames)
}

function classify(target: number, frames: PitchFrame[]): Verdict {
  if (frames.length < MIN_FRAMES) return { code: '—', median: null, cents: null }
  const midis = frames.map((f) => f.midi).sort((a, b) => a - b)
  const median = midis[Math.floor(midis.length / 2)]
  const p10 = midis[Math.floor(midis.length * 0.1)]
  const p90 = midis[Math.floor(midis.length * 0.9)]
  const cents = (median - target) * 100
  if (p90 - p10 > 0.5) return { code: '~', median, cents }
  if (Math.abs(cents) <= PASS_CENTS) return { code: 'P', median, cents }
  // same pitch class but landed in another octave (harmonic picked as fundamental)
  const pcCents = ((((median - target) % 12) + 18) % 12 - 6) * 100
  if (Math.abs(pcCents) <= PASS_CENTS) return { code: 'O', median, cents }
  return { code: 'N', median, cents }
}

function describeVerdict(target: number, v: Verdict): string {
  const heard =
    v.median === null
      ? 'nothing'
      : `${midiToName(Math.round(v.median))} (${fmtCents(v.cents as number)})`
  return `Played ${midiToName(target)} → heard ${heard} — ${CODE_LABEL[v.code]}`
}

async function runOne(target: number): Promise<Verdict | null> {
  if (busy || !(await ensureMic())) return null
  busy = true
  app.classList.add('busy')
  verdictEl.className = 'verdict'
  verdictEl.textContent = `Playing ${midiToName(target)} — listening…`
  const v = await verify(target)
  verdictEl.textContent = describeVerdict(target, v)
  verdictEl.className = `verdict ${CODE_CLASS[v.code]}`
  busy = false
  app.classList.remove('busy')
  return v
}

function fillRow(midi: number, v: Verdict): void {
  const row = app.querySelector(`[data-row="${midi}"]`) as HTMLElement
  const result = row.querySelector('[data-result]') as HTMLElement
  const heard = row.querySelector('[data-heard]') as HTMLElement
  result.textContent = CODE_LABEL[v.code]
  result.className = CODE_CLASS[v.code]
  heard.textContent =
    v.median === null ? '–' : `${midiToName(Math.round(v.median))} ${fmtCents(v.cents as number)}`
}

function startRecording(): void {
  recording = true
  recordStart = performance.now()
  rows = []
  recBtn.textContent = '⏹ Stop & download CSV'
  recBtn.classList.add('recording')
}

function finishRecording(): void {
  recording = false
  recBtn.textContent = '⏺ Record diagnostics'
  recBtn.classList.remove('recording')
  const header = [
    '# TwinkleTune audio-lab diagnostics',
    `# exported: ${new Date().toISOString()}`,
    `# userAgent: ${navigator.userAgent}`,
    `# sampleRate: ${audioCtx().sampleRate}`,
    `# trackSettings: ${JSON.stringify(tracker.trackSettings)}`,
    '# rows contain only frames that passed the engine gates (rms >= 0.01, clarity >= 0.8, 70-1500 Hz)',
    't_ms,raw_hz,median_midi,clarity,rms',
  ]
  const blob = new Blob([header.concat(rows).join('\n') + '\n'], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `audio-lab-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  rows = []
}

micBtn.addEventListener('click', () => {
  if (tracker.running) stopMic()
  else void ensureMic()
})

recBtn.addEventListener('click', async () => {
  if (recording) finishRecording()
  else if (await ensureMic()) startRecording()
})

app.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((key) =>
  key.addEventListener('click', () => void runOne(Number(key.dataset.key))),
)

app.querySelectorAll<HTMLButtonElement>('[data-tone]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const midi = Number(btn.dataset.tone)
    const v = await runOne(midi)
    if (v) fillRow(midi, v)
  }),
)

sweepBtn.addEventListener('click', async () => {
  if (busy || !(await ensureMic())) return
  sweepBtn.disabled = true
  for (const [i, midi] of REFERENCE_TONES.entries()) {
    if (i > 0) await sleep(SWEEP_GAP_MS)
    const v = await runOne(midi)
    if (!v) break
    fillRow(midi, v)
  }
  sweepBtn.disabled = false
})
