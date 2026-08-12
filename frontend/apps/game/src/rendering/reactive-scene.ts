import { CanvasScene } from './canvas-scene'
import {
  DEFAULT_VISUAL_STATE,
  normalizeVisualState,
  type ReactiveScene,
  type ReactiveSceneOptions,
  type ReactiveVisualState,
  type RendererKind,
} from './types'
import { WebGpuScene } from './webgpu-scene'

class ProgressiveScene implements ReactiveScene {
  private active: ReactiveScene | null = null
  private state = { ...DEFAULT_VISUAL_STATE }
  private pendingBurst = 0
  private explicitlyPaused = false
  private destroyed = false
  private rendererKind: RendererKind = 'pending'
  private resolveReady!: (renderer: RendererKind) => void
  readonly ready: Promise<RendererKind>

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly options: ReactiveSceneOptions,
  ) {
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve
    })
    canvas.dataset.renderer = 'pending'
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    void this.initialize()
  }

  get renderer(): RendererKind {
    return this.rendererKind
  }

  update(next: Partial<ReactiveVisualState>): void {
    this.state = normalizeVisualState(this.state, next)
    this.active?.update(this.state)
  }

  burst(strength = 1): void {
    this.pendingBurst = Math.max(this.pendingBurst, strength)
    this.active?.burst(strength)
    if (this.active) this.pendingBurst = 0
  }

  pause(): void {
    this.explicitlyPaused = true
    this.active?.pause()
  }

  resume(): void {
    this.explicitlyPaused = false
    if (document.visibilityState !== 'hidden') this.active?.resume()
  }

  destroy(): void {
    this.destroyed = true
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.active?.destroy()
    this.active = null
  }

  private async initialize(): Promise<void> {
    const reduced =
      this.options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      this.activate(new CanvasScene(this.canvas, this.options, false))
      return
    }

    try {
      const gpu = await WebGpuScene.create(this.canvas, this.options, () => this.fallBackFromDeviceLoss())
      if (this.destroyed) gpu.destroy()
      else this.activate(gpu)
    } catch {
      if (!this.destroyed) this.activate(new CanvasScene(this.canvas, this.options))
    }
  }

  private activate(scene: ReactiveScene): void {
    this.active?.destroy()
    this.active = scene
    this.rendererKind = scene.renderer
    this.canvas.dataset.renderer = scene.renderer
    scene.update(this.state)
    if (this.pendingBurst) {
      scene.burst(this.pendingBurst)
      this.pendingBurst = 0
    }
    if (this.explicitlyPaused || document.visibilityState === 'hidden') scene.pause()
    else scene.resume()
    this.options.onRendererChange?.(scene.renderer)
    this.resolveReady(scene.renderer)
  }

  private fallBackFromDeviceLoss(): void {
    if (this.destroyed || this.rendererKind !== 'webgpu') return
    // A canvas cannot switch context modes after WebGPU has claimed it. Replace
    // only the decorative node; gameplay DOM and state remain untouched.
    const replacement = this.canvas.cloneNode(false) as HTMLCanvasElement
    this.canvas.replaceWith(replacement)
    this.canvas = replacement
    this.activate(new CanvasScene(replacement, this.options))
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.active?.pause()
    else if (!this.explicitlyPaused) this.active?.resume()
  }
}

export function createReactiveScene(
  canvas: HTMLCanvasElement,
  options: ReactiveSceneOptions,
): ReactiveScene {
  return new ProgressiveScene(canvas, options)
}

export type { ReactiveScene, ReactiveSceneOptions, ReactiveVisualState, RendererKind } from './types'
export { normalizeMicEnergy, normalizeVisualState, seedFromString } from './types'
