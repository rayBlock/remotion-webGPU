# Remotion + Three.js WebGPU Project Rules

## Animation
- **NEVER** use `useFrame()` from R3F. All animation must use `useCurrentFrame()` from Remotion.
- Compute shader dispatch via `useEffect` with `[frame]` dependency, NOT `useFrame`.

## Declarative Scene Graph
- Use declarative R3F props: `<mesh rotation={[x, y, z]}>`, `<mesh position={[x, y, z]}>`
- NEVER use imperative ref mutations like `meshRef.current.rotation.y = ...` — refs are `null` on first render, breaking concurrent Remotion rendering.

## TSL Uniforms
- Create uniforms in `useMemo()`, update `.value` in the render body driven by `useCurrentFrame()`.

## Three.js WebGPU Imports
- `import * as THREE from "three/webgpu"`
- TSL imports from `"three/tsl"`
- Must call `import "../utils/extendThree"` (side-effect) at top of each composition entry file to register R3F elements.

## WebGPU Sync
- `<WebGPUSync />` component is REQUIRED inside every `<ThreeCanvas>` — handles async shader compilation + per-frame GPU sync.

## Headless Rendering
- `Config.setChromiumOpenGlRenderer("angle")` in remotion.config.ts — without it, WebGPU content renders black.

## Project Structure
- `src/scenes/<name>/index.tsx` — composition wrapper (ThreeCanvas, WebGPUSync, overlays, Sequences)
- `src/scenes/<name>/<SubScene>.tsx` — individual scene component (no boilerplate)
- `src/components/` — shared UI (BackendOverlay, SceneLabel, BackendDetector)
- `src/hooks/` — shared hooks (useBackendDetection)
- `src/utils/` — shared utilities (createWebGPURenderer, extendThree)
- `src/tsl/` — shared TSL helpers (hashSeed)
- `src/schemas/` — Zod schemas + types
