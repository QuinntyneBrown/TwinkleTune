export type SceneKind = 'sing' | 'results'
export type RendererKind = 'pending' | 'webgpu' | 'canvas2d' | 'static'

export interface ReactiveVisualState {
  /** Normalized microphone energy, from silent (0) to loud (1). */
  energy: number
  onNote: boolean
  streak: number
  progress: number
  /** Vertical singer position, normalized from the top of the scene. */
  pitchY: number
  /** Overall celebration strength, normalized to 0..1. */
  intensity: number
}

export interface ReactiveSceneOptions {
  kind: SceneKind
  seed?: number
  reducedMotion?: boolean
  onRendererChange?: (renderer: RendererKind) => void
}

export interface ReactiveScene {
  readonly renderer: RendererKind
  readonly ready: Promise<RendererKind>
  update(state: Partial<ReactiveVisualState>): void
  burst(strength?: number): void
  pause(): void
  resume(): void
  destroy(): void
}

export const DEFAULT_VISUAL_STATE: ReactiveVisualState = {
  energy: 0,
  onNote: false,
  streak: 0,
  progress: 0,
  pitchY: 0.5,
  intensity: 0.5,
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function normalizeVisualState(
  current: ReactiveVisualState,
  next: Partial<ReactiveVisualState>,
): ReactiveVisualState {
  return {
    energy: clamp01(next.energy ?? current.energy),
    onNote: next.onNote ?? current.onNote,
    streak: Math.max(0, Math.floor(next.streak ?? current.streak)),
    progress: clamp01(next.progress ?? current.progress),
    pitchY: clamp01(next.pitchY ?? current.pitchY),
    intensity: clamp01(next.intensity ?? current.intensity),
  }
}

export function normalizeMicEnergy(rms: number): number {
  // PitchTracker starts accepting sound at 0.01 RMS. A child's clear singing
  // voice is normally visually saturated well before 0.14 RMS.
  return clamp01((rms - 0.01) / 0.13)
}

export function seedFromString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}
