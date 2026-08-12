import {
  DEFAULT_VISUAL_STATE,
  normalizeVisualState,
  type ReactiveScene,
  type ReactiveSceneOptions,
  type ReactiveVisualState,
  type RendererKind,
} from './types'

interface Spark {
  x: number
  y: number
  size: number
  speed: number
  phase: number
  tint: number
  note: boolean
}

export class CanvasScene implements ReactiveScene {
  readonly renderer: RendererKind
  readonly ready: Promise<RendererKind>

  private readonly context: CanvasRenderingContext2D | null
  private readonly sparks: Spark[]
  private state = { ...DEFAULT_VISUAL_STATE }
  private raf = 0
  private paused = false
  private destroyed = false
  private lastFrame = 0
  private burstStarted = -Infinity
  private burstStrength = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: ReactiveSceneOptions,
    private readonly animated = true,
  ) {
    this.context = canvas.getContext('2d')
    this.renderer = animated && this.context ? 'canvas2d' : 'static'
    this.ready = Promise.resolve(this.renderer)
    this.canvas.dataset.renderer = this.renderer
    this.sparks = this.makeSparks(options.kind === 'results' ? 220 : 120, options.seed ?? 0.5)

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(canvas)
    }
    this.resize()
    if (animated && this.context) this.resume()
    else this.draw(performance.now())
  }

  update(next: Partial<ReactiveVisualState>): void {
    this.state = normalizeVisualState(this.state, next)
    if (!this.animated) this.draw(performance.now())
  }

  burst(strength = 1): void {
    if (!this.animated) return
    const now = performance.now()
    if (now - this.burstStarted < 120) return
    this.burstStarted = now
    this.burstStrength = Math.max(0.2, Math.min(1, strength))
  }

  pause(): void {
    this.paused = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  resume(): void {
    if (!this.animated || this.destroyed) return
    this.paused = false
    if (!this.raf) this.raf = requestAnimationFrame(this.frame)
  }

  destroy(): void {
    this.destroyed = true
    this.pause()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  private readonly frame = (now: number): void => {
    this.raf = 0
    if (this.paused || this.destroyed) return
    // Canvas2D is the compatibility path: cap it near 30fps to protect the
    // audio/scoring loop on older tablets.
    if (now - this.lastFrame >= 30) {
      this.lastFrame = now
      this.draw(now)
    }
    this.raf = requestAnimationFrame(this.frame)
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.max(1, Math.round(bounds.width * dpr))
    const height = Math.max(1, Math.round(bounds.height * dpr))
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    this.draw(performance.now())
  }

  private draw(now: number): void {
    const ctx = this.context
    if (!ctx) return
    const width = this.canvas.width
    const height = this.canvas.height
    if (!width || !height) return

    const t = now / 1000
    const energy = this.state.energy * 0.7 + (this.state.onNote ? 0.3 : 0)
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, this.options.kind === 'results' ? '#B9DDF5' : '#FFFFFF')
    gradient.addColorStop(0.55, '#E8F7FF')
    gradient.addColorStop(1, this.options.kind === 'results' ? '#F4DBE3' : '#F3FAFF')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const auraX = width * (this.options.kind === 'sing' ? 0.21 : 0.5)
    const auraY = height * (this.options.kind === 'sing' ? this.state.pitchY : 0.34)
    const auraRadius = Math.max(width, height) * (0.18 + energy * 0.12)
    const aura = ctx.createRadialGradient(auraX, auraY, 0, auraX, auraY, auraRadius)
    aura.addColorStop(0, `rgba(255,214,107,${0.14 + energy * 0.22})`)
    aura.addColorStop(0.45, 'rgba(131,197,241,.13)')
    aura.addColorStop(1, 'rgba(175,227,244,0)')
    ctx.fillStyle = aura
    ctx.fillRect(0, 0, width, height)

    if (this.options.kind === 'sing') this.drawPitchGrid(ctx, width, height)

    const burstAge = (now - this.burstStarted) / 1000
    for (const spark of this.sparks) {
      const life = (t * spark.speed + spark.phase) % 1
      let x = spark.x * width + Math.sin(t * 0.7 + spark.phase * 8) * width * 0.025
      let y = ((spark.y + life * 0.35) % 1) * height
      let alpha = spark.note
        ? (0.22 + this.state.intensity * 0.16 + energy * 0.12) * (0.55 + Math.sin(life * Math.PI) * 0.45)
        : (0.12 + energy * 0.2) * Math.sin(life * Math.PI)
      let size = spark.size * (1 + energy * 0.7)

      if (burstAge >= 0 && burstAge < 1.25 && spark.phase < 0.72) {
        const angle = spark.phase * Math.PI * 14
        const distance = burstAge * Math.min(width, height) * (0.18 + spark.speed * 0.12)
        x = auraX + Math.cos(angle) * distance
        y = auraY + Math.sin(angle) * distance + burstAge * burstAge * height * 0.06
        alpha = (1 - burstAge / 1.25) * this.burstStrength
        size *= 1.7
      }

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(spark.note ? Math.sin(t * 0.35 + spark.phase * 8) * 0.18 : t + spark.phase * 9)
      ctx.fillStyle =
        spark.tint > 0.72
          ? `rgba(160,95,131,${alpha})`
          : spark.tint > 0.42
            ? `rgba(232,180,69,${alpha})`
            : `rgba(43,88,118,${alpha})`
      if (spark.note) this.drawNote(ctx, size, spark.tint > 0.52)
      else this.drawSpark(ctx, size)
      ctx.restore()
    }
  }

  private drawPitchGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(185,221,245,.32)'
    ctx.lineWidth = Math.max(1, height / 300)
    for (let y = height / 6; y < height; y += height / 6) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawSpark(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const radius = i % 2 === 0 ? size : size * 0.28
      const angle = -Math.PI / 2 + (i * Math.PI) / 4
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }

  private drawNote(ctx: CanvasRenderingContext2D, size: number, paired: boolean): void {
    ctx.font = `800 ${Math.round(size * 2.5)}px "Segoe UI Symbol", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(paired ? '♫' : '♪', 0, 0)
  }

  private makeSparks(count: number, seed: number): Spark[] {
    let value = Math.floor(seed * 0x7fffffff) || 1
    const random = (): number => {
      value = (Math.imul(value, 48271) + 1) & 0x7fffffff
      return value / 0x7fffffff
    }
    return Array.from({ length: count }, () => {
      const note = random() > 0.8
      return {
        x: random(),
        y: random(),
        size: note ? 7 + random() * 4 : 2 + random() * 4,
        speed: 0.025 + random() * 0.08,
        phase: random(),
        tint: random(),
        note,
      }
    })
  }
}
