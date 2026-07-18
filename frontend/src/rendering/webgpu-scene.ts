import {
  DEFAULT_VISUAL_STATE,
  normalizeVisualState,
  type ReactiveScene,
  type ReactiveSceneOptions,
  type ReactiveVisualState,
} from './types'

const SHADER = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
  time: f32,
  energy: f32,
  onNote: f32,
  streak: f32,
  progress: f32,
  pitchY: f32,
  burstAge: f32,
  intensity: f32,
  seed: f32,
  kind: f32,
  motion: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), s.x),
             mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), s.x), s.y);
}

struct BackdropOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex fn backdropVertex(@builtin(vertex_index) vertex: u32) -> BackdropOut {
  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: BackdropOut;
  out.position = vec4f(positions[vertex], 0.0, 1.0);
  out.uv = positions[vertex] * 0.5 + vec2f(0.5);
  return out;
}

@fragment fn backdropFragment(in: BackdropOut) -> @location(0) vec4f {
  let uv = vec2f(in.uv.x, 1.0 - in.uv.y);
  let top = select(vec3f(1.0, 1.0, 1.0), vec3f(0.725, 0.867, 0.961), u.kind > 0.5);
  let bottom = select(vec3f(0.953, 0.984, 1.0), vec3f(0.957, 0.859, 0.89), u.kind > 0.5);
  var color = mix(top, bottom, smoothstep(0.0, 1.0, uv.y));
  let drift = noise(uv * vec2f(3.2, 2.2) + vec2f(u.time * 0.035, -u.time * 0.018));
  let ribbon = smoothstep(0.38, 0.82, drift) * (0.045 + u.energy * 0.055);
  color += vec3f(0.35, 0.72, 0.95) * ribbon;
  let anchor = vec2f(select(0.21, 0.5, u.kind > 0.5), select(u.pitchY, 0.34, u.kind > 0.5));
  let aspect = u.resolution.x / max(u.resolution.y, 1.0);
  let delta = (uv - anchor) * vec2f(aspect, 1.0);
  let aura = exp(-dot(delta, delta) * (12.0 - u.energy * 4.0));
  color += mix(vec3f(0.35, 0.72, 0.95), vec3f(1.0, 0.74, 0.22), u.onNote) * aura * (0.08 + u.energy * 0.22);
  if (u.kind < 0.5) {
    let line = 1.0 - smoothstep(0.0, 0.008, abs(fract(uv.y * 6.0) - 0.5));
    color = mix(color, vec3f(0.725, 0.867, 0.961), line * 0.12);
  }
  return vec4f(color, 1.0);
}

struct ParticleOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) alpha: f32,
  @location(2) tint: f32,
  @location(3) note: f32,
}

@vertex fn particleVertex(
  @builtin(vertex_index) vertex: u32,
  @builtin(instance_index) instance: u32,
) -> ParticleOut {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let id = f32(instance);
  let a = hash(vec2f(id + u.seed * 991.0, 1.7));
  let b = hash(vec2f(id * 1.37, u.seed * 433.0 + 4.1));
  let c = hash(vec2f(id * 2.11 + 8.0, u.seed * 173.0));
  let life = fract(u.time * (0.025 + c * 0.07) + b);
  let isNote = select(0.0, 1.0, a > 0.8);
  var center = vec2f(fract(a + sin(u.time * 0.11 + b * 7.0) * 0.025), fract(c + life * 0.34));
  var alpha = mix(
    sin(life * 3.14159) * (0.1 + u.energy * 0.24 + u.intensity * 0.1),
    (0.22 + u.intensity * 0.18 + u.energy * 0.12) * (0.55 + sin(life * 3.14159) * 0.45),
    isNote
  );
  var size = 2.0 + c * 4.0 + u.energy * 2.0;
  size = mix(size, 8.0 + c * 5.0, isNote);
  if (u.burstAge >= 0.0 && u.burstAge < 1.25 && b < 0.74) {
    let angle = a * 43.9823;
    let distance = u.burstAge * (0.16 + c * 0.28);
    let origin = vec2f(select(0.21, 0.5, u.kind > 0.5), select(u.pitchY, 0.34, u.kind > 0.5));
    center = origin + vec2f(cos(angle), sin(angle)) * distance + vec2f(0.0, u.burstAge * u.burstAge * 0.055);
    alpha = (1.0 - u.burstAge / 1.25) * (0.45 + u.intensity * 0.55);
    size *= 1.65;
  }
  let corner = corners[vertex];
  let pixelOffset = corner * size * 2.0 / max(u.resolution, vec2f(1.0));
  var out: ParticleOut;
  out.position = vec4f(center.x * 2.0 - 1.0 + pixelOffset.x, 1.0 - center.y * 2.0 - pixelOffset.y, 0.0, 1.0);
  out.local = corner;
  out.alpha = alpha;
  out.tint = a;
  out.note = isNote;
  return out;
}

fn ellipseMask(p: vec2f, radius: vec2f) -> f32 {
  return 1.0 - smoothstep(0.78, 1.0, length(p / radius));
}

fn boxMask(p: vec2f, halfSize: vec2f) -> f32 {
  let edge = max(abs(p) - halfSize, vec2f(0.0));
  return 1.0 - smoothstep(0.0, 0.09, length(edge));
}

@fragment fn particleFragment(in: ParticleOut) -> @location(0) vec4f {
  let d = length(in.local);
  let diamond = abs(in.local.x) + abs(in.local.y);
  let sparkle = max(1.0 - smoothstep(0.18, 1.0, diamond), (1.0 - smoothstep(0.15, 1.0, d)) * 0.5);
  let noteHead = ellipseMask(in.local - vec2f(-0.22, 0.45), vec2f(0.42, 0.27));
  let noteStem = boxMask(in.local - vec2f(0.12, -0.05), vec2f(0.1, 0.56));
  let noteFlag = ellipseMask(in.local - vec2f(0.36, -0.48), vec2f(0.35, 0.2));
  let musicNote = max(noteHead, max(noteStem, noteFlag));
  let shape = mix(sparkle, musicNote, in.note);
  let blue = vec3f(0.369, 0.659, 0.855);
  let gold = vec3f(1.0, 0.839, 0.42);
  let ink = vec3f(0.169, 0.345, 0.463);
  let pink = vec3f(0.627, 0.373, 0.514);
  let sparkleColor = mix(blue, gold, step(0.52, in.tint));
  let noteColor = mix(ink, pink, step(0.58, in.tint));
  return vec4f(mix(sparkleColor, noteColor, in.note), shape * in.alpha);
}
`

export class WebGpuScene implements ReactiveScene {
  readonly renderer = 'webgpu' as const
  readonly ready = Promise.resolve('webgpu' as const)

  private state = { ...DEFAULT_VISUAL_STATE }
  private readonly uniforms = new Float32Array(16)
  private raf = 0
  private paused = true
  private destroyed = false
  private burstStarted = -Infinity
  private lastBurst = -Infinity
  private frameSamples: number[] = []
  private previousFrame = 0
  private quality = 1
  private resizeObserver: ResizeObserver | null = null

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: ReactiveSceneOptions,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly uniformBuffer: GPUBuffer,
    private readonly bindGroup: GPUBindGroup,
    private readonly backdropPipeline: GPURenderPipeline,
    private readonly particlePipeline: GPURenderPipeline,
    private readonly format: GPUTextureFormat,
    onDeviceLost: () => void,
  ) {
    canvas.dataset.renderer = 'webgpu'
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(canvas)
    }
    this.resize()
    void device.lost.then(() => {
      if (!this.destroyed) onDeviceLost()
    })
    this.resume()
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: ReactiveSceneOptions,
    onDeviceLost: () => void,
  ): Promise<WebGpuScene> {
    if (!navigator.gpu) throw new Error('WebGPU unavailable')
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
    if (!adapter) throw new Error('No WebGPU adapter')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu')
    if (!context) {
      device.destroy()
      throw new Error('No WebGPU canvas context')
    }
    const format = navigator.gpu.getPreferredCanvasFormat()
    const shader = device.createShaderModule({ label: 'TwinkleTune reactive scene', code: SHADER })
    const compilation = await shader.getCompilationInfo()
    if (compilation.messages.some((message) => message.type === 'error')) {
      device.destroy()
      throw new Error('WebGPU shader compilation failed')
    }
    const uniformBuffer = device.createBuffer({
      label: 'TwinkleTune scene uniforms',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }],
    })
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    const backdropPipeline = device.createRenderPipeline({
      label: 'TwinkleTune backdrop pipeline',
      layout,
      vertex: { module: shader, entryPoint: 'backdropVertex' },
      fragment: { module: shader, entryPoint: 'backdropFragment', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    })
    const particlePipeline = device.createRenderPipeline({
      label: 'TwinkleTune particle pipeline',
      layout,
      vertex: { module: shader, entryPoint: 'particleVertex' },
      fragment: {
        module: shader,
        entryPoint: 'particleFragment',
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    })
    return new WebGpuScene(
      canvas,
      options,
      device,
      context,
      uniformBuffer,
      bindGroup,
      backdropPipeline,
      particlePipeline,
      format,
      onDeviceLost,
    )
  }

  update(next: Partial<ReactiveVisualState>): void {
    this.state = normalizeVisualState(this.state, next)
  }

  burst(_strength = 1): void {
    const now = performance.now()
    if (now - this.lastBurst < 120) return
    this.lastBurst = now
    this.burstStarted = now
  }

  pause(): void {
    this.paused = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  resume(): void {
    if (this.destroyed) return
    this.paused = false
    if (!this.raf) this.raf = requestAnimationFrame(this.frame)
  }

  destroy(): void {
    this.destroyed = true
    this.pause()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.uniformBuffer.destroy()
    this.device.destroy()
  }

  private readonly frame = (now: number): void => {
    this.raf = 0
    if (this.paused || this.destroyed) return
    if (this.previousFrame) this.recordFrameTime(now - this.previousFrame)
    this.previousFrame = now
    this.render(now)
    this.raf = requestAnimationFrame(this.frame)
  }

  private render(now: number): void {
    this.resize()
    const burstAge = (now - this.burstStarted) / 1000
    this.uniforms.set([
      this.canvas.width,
      this.canvas.height,
      now / 1000,
      this.state.energy,
      this.state.onNote ? 1 : 0,
      Math.min(1, this.state.streak / 12),
      this.state.progress,
      this.state.pitchY,
      Number.isFinite(burstAge) ? burstAge : -1,
      this.state.intensity,
      this.options.seed ?? 0.5,
      this.options.kind === 'results' ? 1 : 0,
      1,
      0,
      0,
      0,
    ])
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniforms)
    const encoder = this.device.createCommandEncoder({ label: 'TwinkleTune scene frame' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })
    pass.setBindGroup(0, this.bindGroup)
    pass.setPipeline(this.backdropPipeline)
    pass.draw(3)
    pass.setPipeline(this.particlePipeline)
    const baseCount = this.options.kind === 'results' ? 700 : 320
    pass.draw(6, Math.round(baseCount * this.quality))
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality
    const width = Math.max(1, Math.round(bounds.width * dpr))
    const height = Math.max(1, Math.round(bounds.height * dpr))
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width
    this.canvas.height = height
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' })
  }

  private recordFrameTime(delta: number): void {
    if (this.quality < 1 || delta > 250) return
    this.frameSamples.push(delta)
    if (this.frameSamples.length < 120) return
    const average = this.frameSamples.reduce((sum, n) => sum + n, 0) / this.frameSamples.length
    this.frameSamples = []
    if (average > 22) {
      this.quality = 0.65
      this.resize()
      this.canvas.dataset.quality = 'reduced'
    }
  }
}
