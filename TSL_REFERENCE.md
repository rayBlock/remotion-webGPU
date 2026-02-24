# TSL + WebGPU + Remotion: Complete Reference

> Three.js Shading Language (TSL) is a node-based shader system written in JavaScript.
> It compiles to both **WGSL** (WebGPU) and **GLSL** (WebGL) — one codebase, two backends.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Setup (This Repo)](#project-setup-this-repo)
- [TSL Core Concepts](#tsl-core-concepts)
- [Complete TSL Function Reference](#complete-tsl-function-reference)
- [Material Node Slots](#material-node-slots)
- [Showcase Ideas & What You Can Build](#showcase-ideas--what-you-can-build)
- [Learning Resources](#learning-resources)
- [Existing Demos in This Project](#existing-demos-in-this-project)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Remotion Composition                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │              <ThreeCanvas>                         │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │       React Three Fiber (R3F)               │  │   │
│  │  │  ┌───────────────────────────────────────┐  │  │   │
│  │  │  │      WebGPURenderer                   │  │  │   │
│  │  │  │  ┌─────────────────────────────────┐  │  │  │   │
│  │  │  │  │   TSL Node Materials            │  │  │  │   │
│  │  │  │  │   (compiles to WGSL or GLSL)    │  │  │  │   │
│  │  │  │  └─────────────────────────────────┘  │  │  │   │
│  │  │  └───────────────────────────────────────┘  │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key stack:**
- `remotion` — Frame-based video composition in React
- `@remotion/three` — Bridges Remotion hooks into R3F
- `@react-three/fiber` — React renderer for Three.js
- `three/webgpu` — WebGPU-enabled Three.js build
- `three/tsl` — TSL shader functions

---

## Project Setup (This Repo)

**Dependencies:** `three@^0.178`, `@remotion/three@^4.0`, `@react-three/fiber@^9.2`, `remotion@^4.0`

**Renderer initialization** (custom WebGPU renderer in ThreeCanvas):

```tsx
<ThreeCanvas
  gl={async (defaultProps) => {
    const canvas = defaultProps.canvas as HTMLCanvasElement;
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();  // REQUIRED: async init
    return renderer;
  }}
>
```

**Critical Remotion notes:**
- Use `layout="none"` on `<Sequence>` components inside `<ThreeCanvas>`
- For rendering to video: set `chromiumOptions: { gl: "angle" }` in render config
- Animate via `useCurrentFrame()` + uniforms, NOT `useFrame()`

---

## TSL Core Concepts

### 1. Node-Based Composition (Not Imperative Code)

TSL doesn't execute on the CPU — it builds a **shader graph** that compiles to GPU code:

```tsx
// This does NOT compute a sine — it creates a GPU instruction node
const wave = sin(positionLocal.x.mul(4.0).add(timeU.mul(3.0)));
```

### 2. Uniforms (JS ↔ GPU Communication)

```tsx
const timeU = uniform(float(0));     // Create
timeU.value = frame / fps;           // Update each frame from React
```

Update frequencies: `.onFrameUpdate()`, `.onRenderUpdate()`, `.onObjectUpdate()`

### 3. The `Fn()` Pattern

Wrap TSL logic in `Fn()` for complex operations:

```tsx
mat.positionNode = Fn(() => {
  const pos = positionLocal;
  const displacement = sin(pos.x.mul(4.0).add(timeU)).mul(0.15);
  return pos.add(normalLocal.mul(displacement));
})();
```

### 4. Method Chaining

Every operation returns a new node:

```tsx
positionLocal.y.mul(3.0).add(time).sin().mul(0.5).add(0.5)
```

### 5. Type Constructors

```tsx
float(1.0)           // scalar
vec2(x, y)           // 2D vector
vec3(x, y, z)        // 3D vector
color("#ff4500")     // color (vec3)
```

### 6. Swizzling

```tsx
const v = vec3(1, 2, 3);
v.xy   // vec2(1, 2)
v.zyx  // vec3(3, 2, 1)
v.rrr  // vec3(1, 1, 1) — rgba notation
```

---

## Complete TSL Function Reference

### Math Operations

| Function | Description |
|----------|-------------|
| `add(a, b)` / `.add()` | Addition |
| `sub(a, b)` / `.sub()` | Subtraction |
| `mul(a, b)` / `.mul()` | Multiplication |
| `div(a, b)` / `.div()` | Division |
| `mod(a, b)` / `.mod()` | Modulo |
| `negate(x)` | Negation (-x) |
| `abs(x)` | Absolute value |
| `sign(x)` | Sign (-1, 0, 1) |
| `floor(x)`, `ceil(x)`, `round(x)` | Rounding |
| `fract(x)` | Fractional part |
| `clamp(v, lo, hi)` / `.clamp()` | Constrain range |
| `saturate(x)` | Clamp to [0, 1] |
| `min(a, b)`, `max(a, b)` | Min/max |
| `pow(x, y)` | Power |
| `sqrt(x)`, `inverseSqrt(x)`, `cbrt(x)` | Roots |
| `exp(x)`, `exp2(x)` | Exponentials |
| `log(x)`, `log2(x)` | Logarithms |

### Trigonometry

| Function | Description |
|----------|-------------|
| `sin(x)`, `cos(x)`, `tan(x)` | Trig functions |
| `asin(x)`, `acos(x)`, `atan(y, x)` | Inverse trig |
| `sinh(x)`, `cosh(x)`, `tanh(x)` | Hyperbolic |

### Interpolation & Stepping

| Function | Description |
|----------|-------------|
| `mix(a, b, t)` | Linear interpolation (lerp) |
| `step(edge, x)` | 0 if x < edge, else 1 |
| `smoothstep(e0, e1, x)` | Smooth hermite interpolation |
| `remap(v, inLo, inHi, outLo, outHi)` | Range remapping |
| `remapClamp(...)` | Remap with clamping |

### Vector Operations

| Function | Description |
|----------|-------------|
| `dot(a, b)` | Dot product |
| `cross(a, b)` | Cross product |
| `length(v)` | Vector magnitude |
| `distance(a, b)` | Euclidean distance |
| `normalize(v)` | Unit vector |
| `reflect(I, N)` | Reflection |
| `refract(I, N, eta)` | Refraction |
| `faceForward(N, I, Nref)` | Orient normal toward camera |

### Noise Functions (MaterialX)

| Function | Description |
|----------|-------------|
| `mx_noise_float(pos)` | Perlin-style noise |
| `mx_noise_vec3(pos)` | 3-channel noise |
| `mx_fractal_noise_float(pos, octaves, lacunarity, diminish, amplitude)` | Fractal/FBM noise |
| `mx_fractal_noise_vec3(...)` | 3-channel fractal noise |
| `mx_worley_noise_float(pos)` | Worley/cellular noise |
| `mx_worley_noise_vec3(pos)` | 3-channel Worley |
| `hash(seed)` | Pseudorandom [0,1] |

### Procedural Patterns

| Function | Description |
|----------|-------------|
| `checker(coord)` | 2x2 checkerboard |
| `circle(scale, softness, coord)` | Radial gradient |
| `grid(coord, cellSize)` | Grid lines |
| `triplanarTexture(tex, pos, norm)` | Triplanar mapping |

### Oscillators (Animation Helpers)

| Function | Description |
|----------|-------------|
| `oscSine(t)` | Sine wave [0,1] |
| `oscSquare(t)` | Square wave |
| `oscTriangle(t)` | Triangle wave |
| `oscSawtooth(t)` | Sawtooth wave |

### Color Operations

| Function | Description |
|----------|-------------|
| `grayscale(color)` | Desaturate |
| `hue(color, adjustment)` | Rotate hue |
| `saturation(color, adj)` | Adjust saturation |
| `vibrance(color, adj)` | Selective saturation |
| `luminance(color)` | Perceived brightness |
| `posterize(color, steps)` | Reduce color levels |
| `blendScreen(base, blend)` | Screen blend mode |
| `blendDodge(base, blend)` | Color dodge |
| `blendBurn(base, blend)` | Color burn |
| `blendOverlay(base, blend)` | Overlay blend |
| `cdl(color, slope, offset, power, saturation)` | Color Decision List grading |
| `lut3D(node, lut, size, intensity)` | 3D LUT color grading |

### Built-in Inputs

| Node | Space | Description |
|------|-------|-------------|
| `positionLocal` | Object | Vertex position in local space |
| `positionWorld` | World | Vertex position in world space |
| `positionView` | Camera | Vertex position in view space |
| `normalLocal` | Object | Surface normal |
| `normalWorld` | World | World-space normal |
| `normalView` | Camera | View-space normal |
| `uv()` | UV | Texture coordinates |
| `cameraPosition` | World | Camera position |
| `time` | — | Elapsed time (auto) |
| `deltaTime` | — | Frame delta |
| `screenUV` | Screen | Normalized screen coords [0,1] |
| `viewportUV` | Viewport | Viewport UV |
| `vertexIndex` | — | Current vertex index |
| `instanceIndex` | — | Instance index |
| `faceDirection` | — | Front (+1) or back (-1) |

### Control Flow

```tsx
If(condition, () => { ... })
  .ElseIf(condition, () => { ... })
  .Else(() => { ... });

Switch(value)
  .Case(0, () => { ... })
  .Case(1, 2, () => { ... })
  .Default(() => { ... });

Loop(count, ({ i }) => { ... });
Loop({ start: 0, end: 10, type: 'int' }, ({ i }) => { ... });

select(condition, trueVal, falseVal);  // ternary
Discard();   // fragment discard
Break();     // loop break
Continue();  // loop continue
Return();    // function return
```

### Derivatives (Fragment Shader Only)

| Function | Description |
|----------|-------------|
| `dFdx(x)`, `dFdy(x)` | Partial derivatives |
| `fwidth(x)` | Sum of abs derivatives |

### UV Utilities

| Function | Description |
|----------|-------------|
| `rotateUV(uv, angle, center)` | Rotate UV coords |
| `spherizeUV(uv)` | Spherical distortion |
| `spritesheetUV(...)` | Spritesheet animation |
| `equirectUV(dir)` | Equirectangular mapping |
| `matcapUV` | Matcap texture coords |

---

## Material Node Slots

TSL extends built-in materials through **node slots** — you override specific parts of the rendering pipeline while keeping PBR lighting, shadows, and fog intact.

### Available on All Node Materials

| Slot | What it Controls |
|------|-----------------|
| `.colorNode` | Base color (replaces `color * map`) |
| `.opacityNode` | Opacity |
| `.emissiveNode` | Self-illumination color |
| `.normalNode` | Surface normal (for bump/normal mapping) |
| `.positionNode` | Vertex displacement |
| `.depthNode` | Depth write |
| `.alphaTestNode` | Alpha test threshold |
| `.lightsNode` | Custom lighting model |
| `.envNode` | Environment map |
| `.outputNode` | Final output override |
| `.fragmentNode` | Replace entire fragment shader |
| `.vertexNode` | Replace entire vertex shader |

### MeshStandardNodeMaterial

| Slot | Description |
|------|-------------|
| `.metalnessNode` | Metallic factor |
| `.roughnessNode` | Roughness factor |
| `.aoNode` | Ambient occlusion |

### MeshPhysicalNodeMaterial (extends Standard)

| Slot | Description |
|------|-------------|
| `.clearcoatNode`, `.clearcoatRoughnessNode`, `.clearcoatNormalNode` | Clearcoat layer |
| `.sheenNode`, `.sheenRoughnessNode`, `.sheenColorNode` | Fabric sheen |
| `.iridescenceNode`, `.iridescenceIORNode`, `.iridescenceThicknessNode` | Thin-film iridescence |
| `.transmissionNode`, `.thicknessNode` | Glass/liquid transmission |
| `.iorNode` | Index of refraction |
| `.specularIntensityNode`, `.specularColorNode` | Specular control |
| `.anisotropyNode` | Anisotropic reflections |
| `.dispersionNode` | Chromatic dispersion |

---

## Post-Processing Effects (TSL-Based)

All usable as single function calls in a post-processing pass:

| Effect | Function | Description |
|--------|----------|-------------|
| Bloom | `bloom(node, strength, radius, threshold)` | Glow on bright areas |
| Gaussian Blur | `gaussianBlur(node, dir, sigma)` | Smooth blur |
| Box Blur | `boxBlur(node, options)` | Fast blur |
| DOF | `dof(node, viewZ, focus, focalLen, bokeh)` | Depth of field |
| FXAA | `fxaa()` | Anti-aliasing |
| Film Grain | `film(node, intensity, uv)` | Film grain overlay |
| Chromatic Aberration | `chromaticAberration(node, strength)` | RGB split |
| Dot Screen | `dotScreen(node, angle, scale)` | Halftone |
| Motion Blur | `motionBlur(node, velocity, samples)` | Motion blur |
| Godrays | `godrays(depth, camera, light)` | Light shafts |
| Denoise | `denoise(node, depth, normal, cam)` | AI-style denoise |
| Anamorphic | `anamorphic(node, thresh, scale, samples)` | Anamorphic lens flares |
| After Image | `afterImage(node, damp)` | Motion trail persistence |
| Glitch | `glitch()` | Digital glitch |
| Barrel Distortion | `barrelUV(curvature, coord)` | Lens distortion |
| Ambient Occlusion | `ao(depth, normal, camera)` | GTAO |
| Lens Flare | `lensflare(bloom, params)` | Lens flare from bloom |
| Outline | `outline(...)` | Object outline |
| SSGI | `ssgi(...)` | Screen-space global illumination |
| SSR | `ssr(...)` | Screen-space reflections |

---

## Compute Shaders (WebGPU Only)

TSL supports compute shaders for GPGPU — massive parallelism for particles, physics, simulations:

```tsx
const computeFn = Fn(() => {
  const idx = globalId.x;
  const pos = positionBuffer.element(idx);
  const vel = velocityBuffer.element(idx);

  // Apply forces
  vel.addAssign(gravity.mul(deltaTime));
  pos.addAssign(vel.mul(deltaTime));

  // Write back
  positionBuffer.element(idx).assign(pos);
  velocityBuffer.element(idx).assign(vel);
});

const compute = computeFn().compute(particleCount);
renderer.computeAsync(compute);
```

**Key compute nodes:** `globalId`, `localId`, `workgroupId`, `numWorkgroups`, `subgroupSize`

**Atomics:** `atomicAdd`, `atomicSub`, `atomicMin`, `atomicMax`, `atomicAnd`, `atomicOr`, `atomicXor`

**Barriers:** `workgroupBarrier()`, `storageBarrier()`, `textureBarrier()`

**Storage:** `storage(buffer)`, `storageTexture(tex)`, `instancedArray(count, type)`, `attributeArray(count, type)`

---

## Showcase Ideas & What You Can Build

### Beginner-Level Showcases
1. **Animated gradient sphere** — `mix()` + `sin(time)` color transitions
2. **Pulsating emissive object** — `emissiveNode` oscillating with `oscSine()`
3. **UV-distorted checkerboard** — `checker()` + `mx_noise_float()` on UV
4. **Fresnel rim glow** — `dot(normalWorld, viewDir)` for edge lighting

### Intermediate Showcases
5. **Fractal noise terrain** — `mx_fractal_noise_float()` displacement on a plane
6. **Crystal with transmission** — Worley noise + IOR + thickness
7. **Holographic material** — Hue-shifted rainbow via Fresnel + position
8. **Procedural planet** — Combine noise layers for continents, oceans, atmosphere
9. **Triplanar-mapped rocks** — `triplanarTexture()` for seamless texture mapping
10. **Animated wireframe dissolve** — Noise-driven alpha test with `Discard()`

### Advanced Showcases
11. **GPU particle system (100K+)** — Compute shaders for position/velocity updates
12. **Interactive text destruction** — Compute-driven vertex displacement with spring physics
13. **Galaxy simulation** — 750K particles in spiral arms with bloom post-processing
14. **Fluid simulation** — Compute shader Navier-Stokes on storage textures
15. **Procedural city/terrain flyover** — Height map + instanced buildings
16. **Audio-reactive visualization** — Uniforms driven by FFT data → vertex displacement + color
17. **Ray marching SDF scenes** — `fragmentNode` override with distance field rendering
18. **Volumetric fog/clouds** — Ray marching through noise in fragment shader
19. **Reaction-diffusion patterns** — Gray-Scott model via compute shaders
20. **Iridescent soap bubbles** — Thin-film interference + animated thickness

### Post-Processing Showcases
21. **Cinematic color grading** — `cdl()` + `lut3D()` + film grain
22. **Tilt-shift miniature** — Depth of field with custom focus plane
23. **CRT/retro monitor effect** — Barrel distortion + scanlines + chromatic aberration
24. **Glitch transitions** — `glitch()` + `afterImage()` between scenes
25. **Bloom + godrays** — Sun shaft + glow composition

---

## TSL Textures Library (54 Procedural Textures)

The [tsl-textures](https://github.com/boytchev/tsl-textures) library provides ready-made procedural textures:

| Category | Textures |
|----------|----------|
| **Organic** | brain, protozoa, dalmatian-spots, tiger-fur, zebra-lines, watermelon, reticular-veins |
| **Stone/Earth** | marble, concrete, karst-rock, cork, cave-art, roman-paving, rough-clay, rust |
| **Wood** | wood, processed-wood |
| **Atmospheric** | clouds, turbulent-smoke, caustics, water-drops, stars |
| **Geometric** | circles, circle-decor, polka-dots, grid, isolines, isolayers, bricks |
| **Abstract** | fordite, entangled, neon-lights, satin, waves, darth-maul, dyson-sphere, scream, runny-eggs |
| **Sci-Fi** | planet, gas-giant, photosphere, supersphere, scepter-head |
| **Utility** | perlin-noise, static-noise, melter, rotator, scaler, translator |

Usage:
```tsx
import { marble } from 'tsl-textures/marble';
material.colorNode = marble({ color1: color('#fff'), color2: color('#333'), scale: 2.0 });
```

---

## Learning Resources

### Official Documentation
- [TSL Docs (threejs.org)](https://threejs.org/docs/pages/TSL.html) — Official API reference
- [TSL Wiki (GitHub)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) — Complete specification
- [WebGPURenderer Manual](https://threejs.org/manual/en/webgpurenderer.html) — Renderer setup guide
- [@remotion/three docs](https://www.remotion.dev/docs/three) — Remotion integration

### Tutorials & Courses
- [SBCode TSL Tutorials](https://sbcode.net/tsl/) — Comprehensive tutorial series
- [Three.js Roadmap: TSL Guide](https://threejsroadmap.com/blog/tsl-a-better-way-to-write-shaders-in-threejs) — Practical patterns
- [Nik Lever's TSL Course](https://niklever.com/getting-to-grips-with-threejs-shading-language-tsl/) — Getting to grips with TSL
- [GPGPU Particles with TSL (Wawa Sensei)](https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu) — Particle compute shaders
- [Christian Helgeson's TSL Tutorials (GitHub)](https://github.com/cmhhelgeson/Threejs_TSL_Tutorials) — Code repository

### In-Depth Articles
- [Field Guide to TSL and WebGPU (Maxime Heckel)](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/) — Comprehensive field guide
- [Interactive Text Destruction (Codrops)](https://tympanus.net/codrops/2025/07/22/interactive-text-destruction-with-three-js-webgpu-and-tsl/) — Compute + spring physics
- [Introduction to TSL (Medium)](https://arie-m-prasetyo.medium.com/introduction-to-tsl-0e1fda1beffe) — Beginner introduction
- [TSL: A New Era for Shaders (Medium)](https://medium.com/@gianluca.lomarco/three-js-shading-language-a-new-era-for-shaders-cd48de8b22b0) — Overview article
- [WebGPU Migration Checklist 2026](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) — Migration guide

### Example Projects
- [WebGPU Galaxy (GitHub)](https://github.com/dgreenheck/webgpu-galaxy) — Galaxy shader with TSL + WebGPU
- [Galaxy Simulation (Three.js Roadmap)](https://threejsroadmap.com/blog/galaxy-simulation-webgpu-compute-shaders) — 750K particle galaxy
- [three-tsl-webgpu (GitHub)](https://github.com/craftlinks/three-tsl-webgpu) — TSL + WebGPU examples
- [TSL Textures (GitHub)](https://github.com/boytchev/tsl-textures) — 54 procedural textures
- [Shade - WebGPU Graphics (Forum)](https://discourse.threejs.org/t/shade-webgpu-graphics/66969) — Visual shader editor

### Three.js Community
- [Three.js Forum - WebGPU/TSL discussions](https://discourse.threejs.org/t/three-js-introduction-to-webgpu-and-tsl/78205)
- [Three.js Examples (official)](https://threejs.org/examples/?q=webgpu) — Filter by "webgpu" for 100+ examples

---

## Existing Demos in This Project

Your `WebGPUScene.tsx` currently showcases 4 TSL techniques across 150 frames:

| # | Frames | Component | TSL Techniques Used |
|---|--------|-----------|-------------------|
| 1 | 0-36 | `NoiseDisplacementSphere` | `mx_fractal_noise_float` vertex displacement, `mix` color blending, iridescence |
| 2 | 37-73 | `FresnelCrystal` | `mx_worley_noise_float`, Fresnel via `dot`/`normalize`/`pow`, transmission/IOR |
| 3 | 74-110 | `ProceduralTorus` | `checker` + `mx_noise_float` UV distortion, `mix` metalness/roughness |
| 4 | 111-149 | `HolographicRibbon` | `sin`/`cos` vertex waves, HSV rainbow via `fract`+`sin` offsets, iridescence |

---

## Quick Recipe: Adding a New TSL Scene

```tsx
function MyNewScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);

  const { material, timeU } = useMemo(() => {
    const timeU = uniform(float(0));
    const mat = new THREE.MeshPhysicalNodeMaterial();

    // === YOUR TSL MAGIC HERE ===
    // mat.colorNode = ...
    // mat.positionNode = ...
    // mat.emissiveNode = ...

    return { material: mat, timeU };
  }, []);

  // Drive time from Remotion frames (deterministic!)
  timeU.value = frame / fps;

  // Optional rotation
  if (meshRef.current) {
    meshRef.current.rotation.y = (frame / fps) * 0.5;
  }

  return (
    <mesh ref={meshRef} material={material}>
      {/* Your geometry */}
      <sphereGeometry args={[1.5, 128, 128]} />
    </mesh>
  );
}
```

Then add to `Root.tsx`:
```tsx
<Sequence from={150} durationInFrames={60} layout="none">
  <MyNewScene />
</Sequence>
```

---

## Debugging TSL

Inspect compiled shader output:
```tsx
const shader = await renderer.debug.getShaderAsync(material);
console.log(shader.vertexShader);
console.log(shader.fragmentShader);
```

Label nodes for readable debug output:
```tsx
const myVal = sin(time.mul(2.0)).toVar("myAnimatedValue");
```
