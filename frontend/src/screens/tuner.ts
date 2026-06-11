import { PitchTracker } from '../audio/pitch'
import { midiToName } from '../audio/range'
import { skyDecor } from '../ui/parts'

/** Hidden dev screen (#/tuner) for verifying pitch detection accuracy. */
export function renderTuner(root: HTMLElement): () => void {
  const tracker = new PitchTracker()
  let raf = 0

  root.innerHTML = `
  ${skyDecor()}
  <main class="screen screen--nonav">
    <header class="topbar rise">
      <a class="icon-btn" href="#/home" aria-label="Go back">←</a>
      <h1 class="title">Tuner (dev)</h1>
      <span class="spacer"></span>
    </header>
    <section class="card">
      <div class="tuner-note" data-note>—</div>
      <div class="tuner-cents">
        <div class="center"></div>
        <div class="needle" data-needle></div>
      </div>
      <div class="tuner-meta">
        <span data-hz>0.0 Hz</span>
        <span data-clarity>clarity 0%</span>
        <span data-rms>rms 0.000</span>
      </div>
    </section>
    <div class="ctas" style="margin-top:18px">
      <button class="btn btn-xl" data-toggle>Start listening 🎤</button>
    </div>
  </main>`

  const note = root.querySelector('[data-note]') as HTMLElement
  const needle = root.querySelector('[data-needle]') as HTMLElement
  const hzEl = root.querySelector('[data-hz]') as HTMLElement
  const clarityEl = root.querySelector('[data-clarity]') as HTMLElement
  const rmsEl = root.querySelector('[data-rms]') as HTMLElement
  const btn = root.querySelector('[data-toggle]') as HTMLButtonElement

  function loop(): void {
    raf = requestAnimationFrame(loop)
    const f = tracker.read()
    if (!f) {
      note.textContent = '—'
      return
    }
    const nearest = Math.round(f.midi)
    const cents = (f.midi - nearest) * 100
    note.textContent = midiToName(nearest)
    needle.style.left = `calc(50% + ${(cents / 50) * 50}% - 4px)`
    hzEl.textContent = `${f.hz.toFixed(1)} Hz`
    clarityEl.textContent = `clarity ${(f.clarity * 100).toFixed(0)}%`
    rmsEl.textContent = `rms ${f.rms.toFixed(3)}`
  }

  btn.addEventListener('click', async () => {
    if (tracker.running) {
      tracker.stop()
      cancelAnimationFrame(raf)
      btn.textContent = 'Start listening 🎤'
      return
    }
    try {
      await tracker.start()
      btn.textContent = 'Stop'
      loop()
    } catch {
      note.textContent = 'mic?'
    }
  })

  return () => {
    cancelAnimationFrame(raf)
    tracker.stop()
  }
}
