# Remotion + WebGPU + Three.js Shading Language

A collection of GPU-rendered video compositions built with [Remotion](https://www.remotion.dev/), [Three.js WebGPU renderer](https://threejs.org/), and [Three.js Shading Language (TSL)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language).

All shading, particle systems, and compute work runs natively on WebGPU with TSL — no hand-written WGSL or GLSL.

## Stack

- **Remotion** 4.0 — deterministic, frame-perfect video rendering in React
- **Three.js** 0.178 — `three/webgpu` renderer with async init
- **React Three Fiber** 9.2 — declarative Three.js via `@react-three/fiber`
- **TSL** — `three/tsl` node-based shading (materials, compute, SDF)
- **React** 19, **TypeScript** 5.7

## Compositions

### WebGPUScene
4 material demos showcasing core TSL patterns:
- **Noise Displacement Sphere** — `mx_fractal_noise_float` vertex displacement
- **Fresnel Crystal** — Worley noise + Fresnel + transmission
- **Procedural Torus** — checker pattern + noise UV distortion
- **Holographic Ribbon** — sin/cos vertex waves + rainbow color

### ExtraordinaryWebGPUScene
6 advanced scenes (50 frames each):
1. Liquid Iridescent Plasma Blob
2. Synthwave Neon Grid Terrain
3. Flow-Field GPU Particle Swarm
4. Galactic Point Cloud Nebula
5. Mandelbulb Raymarcher
6. Quantum Geometry Morphing

### CrazyWebGPUScene
GPU compute particle system with 15K boids, flow fields, and phase transitions across 3 distinct swarm behaviors.

### LimitBreaker
5 scenes pushing TSL to its limits (90 frames each):
1. **Cosmic Forge** — full SDF ray marching via `colorNode` + `Fn()` + `Loop(80)` + `If/Break`
2. **Omnimaterial** — all 17+ `MeshPhysicalNodeMaterial` node slots animated with TSL
3. **Genesis Planet** — 3-layer planet (surface/clouds/atmosphere) with 6-biome mapping
4. **Entropy** — `Discard()` dissolution with edge glow + vertex warp
5. **Nexus** — 50K instanced icosahedrons with hash-seeded positions + flow field advection

### ParticleForge
5 GPU compute particle scenes (90 frames each):
1. **Spiral Galaxy** — 200K particles in Keplerian orbits
2. **Morphing Shapes** — 100K particles transitioning between sphere/cube/torus/helix
3. **Flow Field** — 150K particles in curl-noise advection
4. **Supernova** — 200K particle explosion and implosion
5. **Aurora Veil** — 300K particles forming borealis sheets

### BoidsWebGPUScene
GPU compute boids flocking simulation.

### SPHFluidWebGPUScene
SPH (Smoothed Particle Hydrodynamics) fluid simulation on the GPU.

## Getting Started

```bash
npm install
npm run dev
```

This opens Remotion Studio at `http://localhost:3000`. Select any composition from the sidebar to preview.

### Rendering

```bash
# Render the default composition
npm run build

# Render a specific composition
npx remotion render <CompositionId> out/video.mp4
```

> **Note:** Rendering requires a Chromium with WebGPU support. The config uses `--gl=angle` for headless GPU access (see `remotion.config.ts`).

## Project Structure

```
src/
├── components/         Shared UI (BackendDetector, BackendOverlay, SceneLabel)
│   └── Canvas/         WebGPUCanvas wrapper with frame sync
├── hooks/              useBackendDetection
├── tsl/                TSL utilities (hash seed generation)
├── utils/              createWebGPURenderer, TransitionMaterial
├── scenes/             All 7 composition scene files
├── schemas/            Zod schemas for configurable compositions
├── Root.tsx            Composition definitions
├── WebGPUSync.tsx      Shader compilation warmup
└── index.ts            Entry point
```

## Key Patterns

- **WebGPU renderer** requires async init: `await renderer.init()`
- **TSL uniforms** driven by `useCurrentFrame() / fps` for deterministic animation
- **Materials** created in `useMemo()`, uniforms updated each frame
- **Compute shaders** dispatched via `renderer.compute(node)` inside `useFrame()`
- **`extend(THREE)`** from `three/webgpu` registers WebGPU-compatible elements with R3F

## License

MIT
