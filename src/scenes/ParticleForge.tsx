import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    cos,
    vec3,
    vec4,
    positionLocal,
    normalize,
    dot,
    pow,
    abs,
    sub,
    max,
    min,
    clamp,
    step,
    smoothstep,
    length,
    fract,
    instanceIndex,
    storage,
    Fn,
    mx_fractal_noise_float,
    mx_fractal_noise_vec3,
    screenUV,
    select,
    hash,
    uv,
} from "three/tsl";
import { ThreeCanvas } from "@remotion/three";
import { WebGPUSync } from "../WebGPUSync";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { extend, useThree } from "@react-three/fiber";
import { ParticleForgeProps } from "../schemas";
import { BackendDetector, BackendOverlay, SceneLabel } from "../components";
import { useBackendDetection } from "../hooks";
import { createWebGPURenderer } from "../utils";
import { hashSeed } from "../tsl";

extend(THREE as any);

// ═══════════════════════════════════════════════════════════════════
// SCENE 1: "Spiral Galaxy" — 200K particles, Keplerian orbits
// ═══════════════════════════════════════════════════════════════════

function SpiralGalaxy({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.galaxyParticles;

    const { posBuffer, computeNode, timeU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            // Per-particle hash seeds
            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);
            const seedD = hashSeed(id, 3);

            // Radius: exponential distribution for galaxy density falloff
            const r = seedA.mul(seedA).mul(5.0).add(0.1);

            // Which arm (0 or 1)
            const arm = step(0.5, seedB).mul(3.14159);

            // Initial angle along the arm with spread
            const baseAngle = seedC.mul(6.2832);
            const armOffset = arm.add(r.mul(float(props.galaxyArmTightness))); // spiral tightness

            // Keplerian orbital speed: faster near center
            const orbitalSpeed = float(2.5).div(r.add(0.3).pow(0.5));
            const angle = baseAngle.add(armOffset).add(orbitalSpeed.mul(timeU));

            // Disk thickness: thinner at edges, thicker near center
            const diskHeight = seedD.sub(0.5).mul(0.15).mul(float(1.0).div(r.add(0.5)));

            // Noise perturbation for organic feel
            const noiseInput = vec3(r.mul(cos(angle)), diskHeight, r.mul(sin(angle))).mul(0.5);
            const perturbation = mx_fractal_noise_vec3(noiseInput.add(vec3(timeU.mul(0.05), 0, 0)), 2, float(2.0), float(0.5), float(1.0));

            const x = r.mul(cos(angle)).add(perturbation.x.mul(0.2));
            const y = diskHeight.add(perturbation.y.mul(0.1));
            const z = r.mul(sin(angle)).add(perturbation.z.mul(0.2));

            pos.assign(vec4(x, y, z, r));
        });

        const computeNode = computeFn().compute(COUNT);

        // Material
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        // Color by radius (stored in .w): hot white core → orange → blue → purple
        const r_val = instancePos.w;
        const t1 = smoothstep(0.0, 1.0, r_val);
        const t2 = smoothstep(1.0, 3.0, r_val);
        const t3 = smoothstep(3.0, 5.0, r_val);

        const coreWhite = color(props.galaxyCoreColor);
        const midOrange = color(props.galaxyMidColor);
        const outerBlue = color(props.galaxyOuterColor);
        const edgePurple = color(props.galaxyEdgeColor);

        const c1 = mix(coreWhite, midOrange, t1);
        const c2 = mix(c1, outerBlue, t2);
        const galaxyColor = mix(c2, edgePurple, t3);

        // Brightness falloff with radius
        const brightness = float(1.5).div(r_val.add(0.3));
        mat.colorNode = galaxyColor.mul(brightness.clamp(0.3, 2.0));

        return { posBuffer: posStorage, computeNode, timeU, material: mat };
    }, [props.galaxyParticles, props.galaxyArmTightness, props.galaxyCoreColor, props.galaxyMidColor, props.galaxyOuterColor, props.galaxyEdgeColor]);

    timeU.value = frame / fps;

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <>
            <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
                <sphereGeometry args={[0.008, 3, 2]} />
            </instancedMesh>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 2: "Morphing Shapes" — 100K particles morph through shapes
// ═══════════════════════════════════════════════════════════════════

function MorphingShapes({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.morphParticles;

    const { computeNode, timeU, progressU, material, posStorage } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));
        const progressU = uniform(float(0)); // 0 to 1 over full scene

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            // Per-particle hash seeds
            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

            // ─── Shape targets ───

            // Sphere (radius 2)
            const theta_s = seedA.mul(6.2832);
            const phi_s = seedB.mul(3.14159);
            const sphere = vec3(
                sin(phi_s).mul(cos(theta_s)).mul(2.0),
                cos(phi_s).mul(2.0),
                sin(phi_s).mul(sin(theta_s)).mul(2.0)
            );

            // Cube (side 3)
            const cube = vec3(
                seedA.sub(0.5).mul(3.0),
                seedB.sub(0.5).mul(3.0),
                seedC.sub(0.5).mul(3.0)
            );

            // Torus (major radius 1.5, minor radius 0.6)
            const theta_t = seedA.mul(6.2832);
            const phi_t = seedB.mul(6.2832);
            const torus = vec3(
                cos(theta_t).mul(float(1.5).add(cos(phi_t).mul(0.6))),
                sin(phi_t).mul(0.6),
                sin(theta_t).mul(float(1.5).add(cos(phi_t).mul(0.6)))
            );

            // Double helix
            const helixT = seedA.mul(6.2832).mul(2.0).sub(6.2832);
            const helixStrand = step(0.5, seedB).mul(2.0).sub(1.0); // -1 or 1
            const helix = vec3(
                cos(helixT).mul(helixStrand).mul(0.8),
                helixT.mul(0.3),
                sin(helixT).mul(helixStrand).mul(0.8)
            );

            // ─── Morphing logic ───
            // 3 transitions over 90 frames: each ~30 frames
            // progress 0→0.333: sphere→cube
            // progress 0.333→0.667: cube→torus
            // progress 0.667→1.0: torus→helix
            const p = progressU;

            const t1 = smoothstep(0.0, 0.333, p);
            const t2 = smoothstep(0.333, 0.667, p);
            const t3 = smoothstep(0.667, 1.0, p);

            const pos1 = mix(sphere, cube, t1);
            const pos2 = mix(pos1, torus, t2);
            const basePos = mix(pos2, helix, t3);

            // Noise displacement during transitions (peaks at midpoints)
            const transitionActivity = sin(p.mul(3.14159).mul(3.0)).abs().mul(0.8);
            const noise = mx_fractal_noise_vec3(
                vec3(id.mul(0.001), timeU.mul(0.3), float(0)),
                2, float(2.0), float(0.5), float(1.0)
            );
            const displaced = basePos.add(noise.mul(transitionActivity));

            // Store shape index in .w for coloring
            const shapeIdx = select(p.lessThan(0.167), float(0.0),
                select(p.lessThan(0.5), float(1.0),
                    select(p.lessThan(0.833), float(2.0), float(3.0))
                )
            );

            pos.assign(vec4(displaced, shapeIdx));
        });

        const computeNode = computeFn().compute(COUNT);

        // Material
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        // Color per shape
        const shapeIdx = instancePos.w;
        const sphereColor = color(props.sphereColor);
        const cubeColor = color(props.cubeColor);
        const torusColor = color(props.torusColor);
        const helixColor = color(props.helixColor);

        const c1 = mix(sphereColor, cubeColor, smoothstep(0.0, 1.0, shapeIdx));
        const c2 = mix(c1, torusColor, smoothstep(1.0, 2.0, shapeIdx));
        mat.colorNode = mix(c2, helixColor, smoothstep(2.0, 3.0, shapeIdx)).mul(1.2);

        return { computeNode, timeU, progressU, material: mat, posStorage };
    }, [props.morphParticles, props.sphereColor, props.cubeColor, props.torusColor, props.helixColor]);

    timeU.value = frame / fps;
    progressU.value = Math.min(frame / 89, 1.0);

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.012, 3, 2]} />
        </instancedMesh>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 3: "Flow Field" — 150K particles in curl-noise volume
// ═══════════════════════════════════════════════════════════════════

function FlowField({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.flowParticles;

    const { computeNode, timeU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            // Per-particle base position (fill a cube volume)
            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

            const basePos = vec3(
                seedA.sub(0.5).mul(6.0),
                seedB.sub(0.5).mul(6.0),
                seedC.sub(0.5).mul(6.0)
            );

            // Large-scale flow field displacement
            const flowInput = basePos.mul(0.3).add(vec3(timeU.mul(0.1), timeU.mul(0.08), timeU.mul(0.06)));
            const largeFlow = mx_fractal_noise_vec3(flowInput, 3, float(2.0), float(0.5), float(1.0));

            // Fine detail layer
            const fineInput = basePos.mul(0.8).add(vec3(timeU.mul(0.15), 0, timeU.mul(0.12)));
            const fineFlow = mx_fractal_noise_vec3(fineInput, 2, float(2.0), float(0.5), float(1.0));

            const displaced = basePos.add(largeFlow.mul(2.0)).add(fineFlow.mul(0.5));

            // Compute speed approximation (finite difference via small time offset)
            const eps = float(0.01);
            const flowInputFwd = basePos.mul(0.3).add(vec3(timeU.add(eps).mul(0.1), timeU.add(eps).mul(0.08), timeU.add(eps).mul(0.06)));
            const largeFlowFwd = mx_fractal_noise_vec3(flowInputFwd, 3, float(2.0), float(0.5), float(1.0));
            const velocity = largeFlowFwd.sub(largeFlow).div(eps);
            const speed = length(velocity);

            pos.assign(vec4(displaced, speed));
        });

        const computeNode = computeFn().compute(COUNT);

        // Material
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        // Speed-based coloring
        const speed = instancePos.w;
        const slowColor = color(props.flowSlowColor);
        const midColor = color(props.flowMidColor);
        const fastColor = color(props.flowFastColor);
        const hotColor = color("#ffffff");

        const s1 = smoothstep(0.0, 0.5, speed);
        const s2 = smoothstep(0.5, 1.5, speed);
        const s3 = smoothstep(1.5, 3.0, speed);

        const c1 = mix(slowColor, midColor, s1);
        const c2 = mix(c1, fastColor, s2);
        mat.colorNode = mix(c2, hotColor, s3).mul(1.0);

        return { computeNode, timeU, material: mat };
    }, [props.flowParticles, props.flowSlowColor, props.flowMidColor, props.flowFastColor]);

    timeU.value = frame / fps;

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.01, 3, 2]} />
        </instancedMesh>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 4: "Supernova" — 200K particles: explosion → implosion
// ═══════════════════════════════════════════════════════════════════

function Supernova({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.supernovaParticles;

    const { computeNode, progressU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const progressU = uniform(float(0)); // 0 to 1 over scene

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            // Per-particle hash seeds
            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);
            const seedD = hashSeed(id, 3);

            // Random direction (unit sphere)
            const theta = seedA.mul(6.2832);
            const phi = seedB.mul(3.14159);
            const dir = vec3(
                sin(phi).mul(cos(theta)),
                cos(phi),
                sin(phi).mul(sin(theta))
            );

            // Particle-specific speed variation
            const speedVar = seedC.mul(0.6).add(0.4); // 0.4 to 1.0

            // ─── Explosion phase (progress 0 → 0.5): radiate outward ───
            // Eased deceleration: fast start, slow end
            const explodeT = smoothstep(0.0, 0.5, progressU);
            const explodeEase = float(1.0).sub(float(1.0).sub(explodeT).pow(2.0)); // ease-out quadratic
            const explodeRadius = explodeEase.mul(5.0).mul(speedVar);
            const explodePos = dir.mul(explodeRadius);

            // ─── Implosion phase (progress 0.5 → 1.0): reconverge to crystal shell ───
            const implodeT = smoothstep(0.5, 1.0, progressU);

            // Crystal shell target: icosahedron-like arrangement on a sphere
            const shellR = float(1.8);
            // Slightly quantized angles for crystalline feel
            const quantTheta = fract(seedA.mul(20.0)).mul(6.2832);
            const quantPhi = fract(seedB.mul(12.0)).mul(3.14159);
            const shellPos = vec3(
                sin(quantPhi).mul(cos(quantTheta)).mul(shellR),
                cos(quantPhi).mul(shellR),
                sin(quantPhi).mul(sin(quantTheta)).mul(shellR)
            );

            const finalPos = mix(explodePos, shellPos, implodeT);

            // .w stores distance from origin for wavefront glow
            const dist = length(finalPos);

            pos.assign(vec4(finalPos, dist));
        });

        const computeNode = computeFn().compute(COUNT);

        // Material
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        // Color transitions: hot white/yellow → ember orange → cool crystalline blue
        const p = progressU;
        const hotWhite = color(props.supernovaHotColor);
        const emberOrange = color(props.supernovaEmberColor);
        const coolBlue = color(props.supernovaCoolColor);
        const crystalWhite = color("#ccddff");

        const phaseColor = mix(hotWhite, emberOrange, smoothstep(0.0, 0.4, p));
        const finalColor = mix(phaseColor, mix(coolBlue, crystalWhite, smoothstep(0.7, 1.0, p)), smoothstep(0.4, 0.8, p));

        // Wavefront glow: brighter at the expanding/contracting edge
        const dist = instancePos.w;
        const expectedRadius = mix(float(0.0), float(5.0), smoothstep(0.0, 0.5, p));
        const edgeBright = float(1.0).sub(abs(dist.sub(expectedRadius)).mul(0.5)).clamp(0.3, 2.0);

        mat.colorNode = finalColor.mul(edgeBright);

        return { computeNode, progressU, material: mat };
    }, [props.supernovaParticles, props.supernovaHotColor, props.supernovaEmberColor, props.supernovaCoolColor]);

    progressU.value = Math.min(frame / 89, 1.0);

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.008, 3, 2]} />
        </instancedMesh>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 5: "Aurora Veil" — 300K particles in aurora borealis sheets
// ═══════════════════════════════════════════════════════════════════

function AuroraVeil({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.auroraParticles;

    const { computeNode, timeU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            // Per-particle hash seeds
            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);
            const seedD = hashSeed(id, 3);

            // 8 horizontal bands
            const bandIdx = fract(id.mul(0.000037)).mul(8.0).floor();
            const bandY = bandIdx.mul(0.5).sub(1.75); // spread bands vertically

            // Horizontal spread along each band
            const xPos = seedA.sub(0.5).mul(8.0);
            const zBase = seedB.sub(0.5).mul(2.0);

            // Sine-wave curtain folds
            const curtainWave = sin(xPos.mul(0.8).add(bandIdx.mul(1.2)).add(timeU.mul(0.5))).mul(0.6);

            // Noise perturbation for organic aurora shape
            const noiseInput = vec3(xPos.mul(0.3), bandY.mul(0.5), timeU.mul(0.15));
            const perturbation = mx_fractal_noise_vec3(noiseInput, 3, float(2.0), float(0.5), float(1.0));

            // Vertical shimmer
            const yOffset = perturbation.y.mul(0.8).add(seedC.sub(0.5).mul(0.3));

            // Traveling brightness wave along the sheet
            const travelWave = sin(xPos.mul(1.5).sub(timeU.mul(2.0)).add(bandIdx.mul(0.7)));
            const shimmer = travelWave.mul(0.5).add(0.5);

            const x = xPos.add(perturbation.x.mul(0.3));
            const y = bandY.add(yOffset);
            const z = zBase.add(curtainWave).add(perturbation.z.mul(0.3));

            // .w encodes height-normalized value for coloring + shimmer
            const heightNorm = y.add(2.0).div(4.0).clamp(0.0, 1.0); // normalize to [0,1]
            pos.assign(vec4(x, y, z, heightNorm.mul(0.5).add(shimmer.mul(0.5))));
        });

        const computeNode = computeFn().compute(COUNT);

        // Material
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        // Aurora color: blue edges → green center → purple top
        const val = instancePos.w; // encodes height + shimmer
        const deepBlue = color(props.auroraBlueColor);
        const auroraGreen = color(props.auroraGreenColor);
        const auroPurple = color(props.auroraPurpleColor);
        const brightWhite = color("#aaffcc");

        const a1 = smoothstep(0.0, 0.3, val);
        const a2 = smoothstep(0.3, 0.6, val);
        const a3 = smoothstep(0.6, 0.9, val);

        const c1 = mix(deepBlue, auroraGreen, a1);
        const c2 = mix(c1, auroPurple, a2);
        mat.colorNode = mix(c2, brightWhite, a3).mul(0.8);

        return { computeNode, timeU, material: mat };
    }, [props.auroraParticles, props.auroraBlueColor, props.auroraGreenColor, props.auroraPurpleColor]);

    timeU.value = frame / fps;

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.006, 3, 2]} />
        </instancedMesh>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Scene labels
// ═══════════════════════════════════════════════════════════════════

const SCENE_LABELS = [
    "1/5: Spiral Galaxy \u2014 200K Keplerian Orbits",
    "2/5: Morphing Shapes \u2014 100K Shape Transitions",
    "3/5: Flow Field \u2014 150K Curl-Noise Advection",
    "4/5: Supernova \u2014 200K Explosion \u2192 Implosion",
    "5/5: Aurora Veil \u2014 300K Borealis Sheets",
];

// ═══════════════════════════════════════════════════════════════════
// Main Composition
// ═══════════════════════════════════════════════════════════════════

export const ParticleForge: React.FC<ParticleForgeProps> = (props) => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 90), 4);

    return (
        <AbsoluteFill style={{ background: "#030308" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 2, 8], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <BackendDetector onDetect={onDetect} />
                <Sequence from={0} durationInFrames={90} layout="none">
                    <SpiralGalaxy props={props} />
                </Sequence>
                <Sequence from={90} durationInFrames={90} layout="none">
                    <MorphingShapes props={props} />
                </Sequence>
                <Sequence from={180} durationInFrames={90} layout="none">
                    <FlowField props={props} />
                </Sequence>
                <Sequence from={270} durationInFrames={90} layout="none">
                    <Supernova props={props} />
                </Sequence>
                <Sequence from={360} durationInFrames={90} layout="none">
                    <AuroraVeil props={props} />
                </Sequence>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />

            {/* Particle count label */}
            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    fontFamily: "monospace",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.5)",
                    background: "rgba(0,0,0,0.5)",
                    padding: "6px 12px",
                    borderRadius: 6,
                }}
            >
                GPU COMPUTE // FRAME {frame}
            </div>
        </AbsoluteFill>
    );
};
