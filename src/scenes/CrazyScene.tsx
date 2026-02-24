import * as THREE from 'three/webgpu';
import {
    color,
    mix,
    uniform,
    float,
    sin,
    cos,
    vec3,
    vec4,
    vec2,
    positionLocal,
    normalLocal,
    positionWorld,
    normalWorld,
    cameraPosition,
    mx_worley_noise_float,
    mx_fractal_noise_float,
    mx_fractal_noise_vec3,
    normalize,
    dot,
    pow,
    abs,
    sub,
    remap,
    step,
    smoothstep,
    fract,
    length,
    instanceIndex,
    uv,
    mat3,
    mat4,
    storage,
    Fn,
    max,
    min,
    If,
    select
} from 'three/tsl';
import { ThreeCanvas } from '@remotion/three';
import { WebGPUSync } from '../WebGPUSync';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { useMemo, useRef, useEffect } from 'react';
import { extend, useThree } from '@react-three/fiber';
import { CrazyWebGPUSceneProps } from "../schemas";
import { createWebGPURenderer } from "../utils";

extend(THREE as any);

// We define the uniform controllers for the overall phases
function useComputePhaseParams(props: CrazyWebGPUSceneProps) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Phase 1: 0-100 frames
    // Phase 2: 100-200 frames
    // Phase 3: 200-300 frames
    const phase = uniform(float(0));
    if (frame < 100) phase.value = 0;
    else if (frame < 200) phase.value = 1;
    else phase.value = 2;

    return { phase };
}

// ─── 1. Compute Shader: Multi-Phase Boids / Swarm Particle Physics ───
function SwarmComputeSystem(props: CrazyWebGPUSceneProps, phaseNode: any) {
    const { gl } = useThree();
    const computeRef = useRef<any>(null);

    const { positionBuffer, velocityBuffer, computeNode, localTime } = useMemo(() => {
        const P_COUNT = props.particleCount;
        // Initialize buffers
        const basePositions = new Float32Array(P_COUNT * 4);
        const baseVelocities = new Float32Array(P_COUNT * 4);

        for (let i = 0; i < P_COUNT; i++) {
            basePositions[i * 4 + 0] = (Math.random() - 0.5) * 5;
            basePositions[i * 4 + 1] = (Math.random() - 0.5) * 5;
            basePositions[i * 4 + 2] = (Math.random() - 0.5) * 5;
            basePositions[i * 4 + 3] = 1;

            baseVelocities[i * 4 + 0] = (Math.random() - 0.5) * 0.2;
            baseVelocities[i * 4 + 1] = (Math.random() - 0.5) * 0.2;
            baseVelocities[i * 4 + 2] = (Math.random() - 0.5) * 0.2;
            baseVelocities[i * 4 + 3] = 0;
        }

        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(basePositions, 4), 'vec4', P_COUNT);
        const velStorage = storage(new THREE.StorageInstancedBufferAttribute(baseVelocities, 4), 'vec4', P_COUNT);

        const localTime = uniform(float(0));

        const computeSwarm = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const vel = velStorage.element(instanceIndex);

            const t = localTime;
            const phase = phaseNode;

            const force = vec3(0, 0, 0).toVar();

            // Multi-phase logic
            If(phase.equal(0), () => {
                // Phase 1: Chaotic swarming around Lissajous curve
                const target = vec3(sin(t.mul(0.5)).mul(4.0), cos(t.mul(0.3)).mul(2.0), sin(t.mul(0.4)).mul(3.0));
                const toTarget = normalize(sub(target, pos.xyz));

                const noiseOffset = vec3(0, t.mul(float(props.flowSpeed)), 0);
                const flow = mx_fractal_noise_vec3(pos.xyz.mul(float(props.flowNoiseScale)).add(noiseOffset), 2, float(2.0), float(0.5), float(1.0));

                force.assign(toTarget.mul(0.01).add(flow.mul(0.02)));
            });

            If(phase.equal(1), () => {
                // Phase 2: Black Hole Accretion Disk
                const singularity = vec3(0, 0, 0); // Center of black hole
                const toSingularity = sub(singularity, pos.xyz);
                const distToSingularity = length(toSingularity);

                // Extreme gravity pulling into the singularity (inverse square law approximation)
                const gravityStrength = float(20.0).div(distToSingularity.add(1.0).pow(2.0));

                // Prevent particles from collapsing entirely into singularity (event horizon pushback)
                const eventHorizonRadius = float(1.2);
                const pushback = smoothstep(eventHorizonRadius, eventHorizonRadius.sub(0.2), distToSingularity).mul(5.0);

                const gravity = normalize(toSingularity).mul(gravityStrength.sub(pushback));

                // Violent orbital tangent force (accretion disk spin)
                // Spin is faster closer to event horizon
                const up = vec3(0, 1, 0);
                const tangent = normalize(toSingularity.cross(up));
                const spinStrength = float(15.0).div(distToSingularity.add(0.5));

                // Add vertical squashing to flatten into a disk
                const diskSquash = vec3(0, pos.y.mul(-0.1), 0);

                force.assign(gravity.add(tangent.mul(spinStrength)).add(diskSquash));
            });

            If(phase.equal(2), () => {
                // Phase 3: Lattice snapping
                // Particles try to snap to nearest 0.5 grid intersections
                const gridSize = float(0.5);
                const snappedPos = pos.xyz.div(gridSize).round().mul(gridSize);
                const pullToGrid = sub(snappedPos, pos.xyz);

                // Slow them down to freeze into the lattice
                vel.xyz = vel.xyz.mul(0.9);
                force.assign(pullToGrid.mul(0.1));
            });

            // Update velocity
            let newVel = vel.xyz.add(force);

            // Clamp speed
            const speed = length(newVel);
            const maxSpeed = float(props.boidSpeed);
            newVel = normalize(newVel).mul(mix(speed, maxSpeed, step(maxSpeed, speed)));

            vel.xyz = newVel;
            pos.xyz = pos.xyz.add(newVel);
        });

        return {
            positionBuffer: posStorage,
            velocityBuffer: velStorage,
            computeNode: computeSwarm().compute(P_COUNT),
            localTime
        };
    }, [props.particleCount, props.boidSpeed, props.flowNoiseScale, props.flowSpeed]);

    // Dispatch compute shader driven by Remotion's frame counter
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Update the localTime uniform and dispatch compute shader per Remotion frame
    // useFrame is FORBIDDEN in Remotion — drive everything from useCurrentFrame
    localTime.value = frame / fps;

    useEffect(() => {
        (gl as any).compute(computeNode);
    }, [frame, gl, computeNode]);

    return { positionBuffer, velocityBuffer };
}

// ─── 2. Swarm Instanced Mesh ───
function CyberSwarm({ props, phaseNode }: { props: CrazyWebGPUSceneProps, phaseNode: any }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { positionBuffer, velocityBuffer } = SwarmComputeSystem(props, phaseNode);

    const material = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial();
        const instancePos = positionBuffer.element(instanceIndex);
        const instanceVel = velocityBuffer.element(instanceIndex);

        // Compute rotation matrix to look along velocity
        const up = vec3(0, 1, 0);
        // Fallback for 0 velocity (lattice state)
        const velDir = select(length(instanceVel.xyz).greaterThan(0.001), normalize(instanceVel.xyz), vec3(1, 0, 0));
        const forward = velDir;
        const right = normalize(forward.cross(up));
        const actualUp = right.cross(forward).normalize();

        const rotatedPos = positionLocal.x.mul(right)
            .add(positionLocal.y.mul(actualUp))
            .add(positionLocal.z.mul(forward));

        mat.positionNode = rotatedPos.add(instancePos.xyz);

        const phase = phaseNode;
        const c1 = color(props.p1SwarmColor);
        const c2 = color(props.p2SwarmColor);
        const c3 = color(props.p3SwarmColor);

        const g1 = color(props.p1SwarmGlow);
        const g2 = color(props.p2SwarmGlow);
        const g3 = color(props.p3SwarmGlow);

        const cyberColor = select(phase.equal(0), c1, select(phase.equal(1), c2, c3));
        const glowColor = select(phase.equal(0), g1, select(phase.equal(1), g2, g3));

        const speedIntensity = length(instanceVel.xyz).mul(20.0).clamp();

        mat.colorNode = color("#000000");
        mat.emissiveNode = mix(glowColor, cyberColor, speedIntensity).mul(2.0);

        const shatter = mx_worley_noise_float(positionLocal.mul(10.0));
        mat.roughnessNode = shatter.mul(0.3);
        mat.metalnessNode = float(1.0);
        mat.transmission = 0.9;
        mat.ior = 2.0;
        mat.thickness = 1.0;

        return mat;
    }, [positionBuffer, velocityBuffer, props]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, props.particleCount]} material={material}>
            <coneGeometry args={[0.02, 0.1, 4]} />
        </instancedMesh>
    );
}

// ─── 3. Infinite Raymarched Background ───
function RaymarchingBackdrop({ props, phaseNode }: { props: CrazyWebGPUSceneProps, phaseNode: any }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, localTime } = useMemo(() => {
        const localTime = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.BackSide;
        mat.depthWrite = false;

        const rmFn = Fn(() => {
            const pcoord = uv().mul(2.0).sub(1.0);
            pcoord.x = pcoord.x.mul(1920.0 / 1080.0);

            const t = localTime.mul(0.2);
            const ro = vec3(0.0, 0.0, -3.0);
            const rd = normalize(vec3(pcoord, 1.0));

            const dO = float(0.0).toVar();
            const phase = phaseNode;

            const volDensity = float(0.0).toVar();

            // 32-step volumetric iteration
            for (let i = 0; i < 32; i++) {
                const p = ro.add(rd.mul(dO));

                // Switch environments based on phase
                If(phase.equal(0), () => {
                    // P1: Fractal Tunnel
                    let q = p.add(vec3(0, 0, t.mul(5.0)));
                    q = fract(q.mul(0.5)).sub(0.5).mul(2.0);
                    const d = length(q).sub(0.5);
                    const isInside = step(d, 0.0);
                    volDensity.addAssign(isInside.mul(0.03));
                });

                If(phase.equal(1), () => {
                    // P2: Black Hole with Gravitational Lensing
                    const singularityPos = vec3(0, 0, 5.0);
                    const toSingularity = p.sub(singularityPos);
                    const distToSingularity = length(toSingularity);

                    // The event horizon sphere
                    const eventHorizon = distToSingularity.sub(1.5);

                    // Gravitational Lensing effect
                    // We bend the light ray (rd) towards the singularity if passing close
                    const lensStrength = float(0.5).div(distToSingularity.add(0.1).pow(2.0));
                    const bendDir = normalize(toSingularity.negate()); // pull ray inward

                    // We apply bending to the ray direction iterativly
                    // This is a rough approximation of curved spacetime but looks epic in SDFs
                    rd.assign(normalize(rd.add(bendDir.mul(lensStrength))));

                    // Accretion disk volumetric glow
                    // A flat noisy disk around the singularity
                    const diskDist = length(vec2(toSingularity.x, toSingularity.z)).sub(1.8);
                    const diskThickness = abs(toSingularity.y).sub(0.2);

                    // Only add density if inside the outer bounds of the disk and outside event horizon
                    const isDisk = step(diskDist, 3.0).mul(step(diskThickness, 0.0)).mul(step(0.0, eventHorizon));

                    // Noise for disk texture
                    const diskNoise = mx_fractal_noise_float(p.mul(3.0).add(vec3(t.mul(5.0), 0, t.mul(5.0))), 3, float(2.0), float(0.5), float(1.0));

                    volDensity.addAssign(isDisk.mul(diskNoise.add(0.5).mul(0.08)));

                    // The event horizon itself absorbs completely (density spike)
                    // but we style it as a hard cutoff later. Just add massive density here
                    const isInsideHorizon = step(eventHorizon, 0.0);
                    volDensity.addAssign(isInsideHorizon.mul(1.0));
                });

                If(phase.equal(2), () => {
                    // P3: Infinite Lattice Grid lines
                    let q = fract(p.mul(2.0)).sub(0.5);
                    // Boxes at intersections
                    const qabs = abs(q);
                    const boxDist = length(max(qabs.sub(vec3(0.05)), 0.0)).add(min(max(qabs.x, max(qabs.y, qabs.z)), 0.0));
                    const isInside = step(boxDist, 0.0);
                    volDensity.addAssign(isInside.mul(0.05));
                });

                dO.addAssign(0.15);
            }

            // Colors per phase
            const core1 = color(props.p1CoreColor);
            const edge1 = color(props.p1EdgeColor);
            const core2 = color(props.p2CoreColor);
            const edge2 = color(props.p2EdgeColor);
            const core3 = color(props.p3CoreColor);
            const edge3 = color(props.p3EdgeColor);

            const cCore = select(phase.equal(0), core1, select(phase.equal(1), core2, core3));
            const cEdge = select(phase.equal(0), edge1, select(phase.equal(1), edge2, edge3));

            const finalCol = mix(vec3(0.0), mix(cCore, cEdge, sin(dO.mul(0.2)).mul(0.5).add(0.5)), volDensity);
            return vec4(finalCol, 1.0);
        });

        mat.colorNode = rmFn();
        return { material: mat, localTime };
    }, [props]);

    localTime.value = frame / fps;

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[40, 40, 40]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

// ─── 4. TSL Glitch Wipe Transition ───
function TransitionOverlay({ progress, timeValue }: { progress: number; timeValue: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    // We pass React props into TSL uniforms
    const { material, progU, timeU } = useMemo(() => {
        const progU = uniform(float(0));
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.depthTest = false;

        mat.colorNode = Fn(() => {
            const u = uv();

            // Scaled Worley noise for digital blocky wipe
            // Use Remotion-driven timeU uniform instead of TSL wall-clock `time`
            const n = mx_worley_noise_float(u.mul(vec2(10.0, 50.0)).add(vec2(0, timeU.mul(2.0))));

            // Map progress 0->1 down to a wiping threshold
            // Note progress sweeps across the screen
            const threshold = progU.mul(1.5).sub(n.mul(0.5));

            // Is it transition band?
            const isWipeActive = step(u.x, threshold).sub(step(u.x, threshold.sub(0.1)));

            // Neon pink / bright white electrical noise tape
            const wipeColor = mix(color("#ffffff"), color("#ff00ff"), n);

            // Alpha: transparent if not in the active band
            const alpha = max(isWipeActive, 0.0);

            return vec4(wipeColor, alpha);
        })();

        return { material: mat, progU, timeU };
    }, []);

    progU.value = progress;
    timeU.value = timeValue;

    return (
        <mesh ref={meshRef} position={[0, 0, 4.9]}>
            <planeGeometry args={[16 * 2, 9 * 2]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

// ─── Scene Setup Wrapper
function SceneWithPhasesAndTransitions({ props }: { props: CrazyWebGPUSceneProps }) {
    const { phase } = useComputePhaseParams(props);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = frame / fps;

    // Calculate wipe transitions
    // Transitions happen between frames 90-110 and 190-210
    const tr1 = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const tr2 = interpolate(frame, [190, 210], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    let activeTrProgress = 0;
    if (frame > 80 && frame < 120) activeTrProgress = tr1;
    if (frame > 180 && frame < 220) activeTrProgress = tr2;

    return (
        <>
            <ambientLight intensity={0.2} />
            <directionalLight position={[0, 10, 10]} intensity={2.0} color="#00ffcc" />
            <pointLight position={[0, 0, 0]} intensity={5.0} color="#ff00ff" distance={10} />

            <RaymarchingBackdrop props={props} phaseNode={phase} />
            <CyberSwarm props={props} phaseNode={phase} />

            {/* Overlay pinned immediately in front of camera */}
            {activeTrProgress > 0 && activeTrProgress < 1 && (
                <TransitionOverlay progress={activeTrProgress} timeValue={t} />
            )}
        </>
    );
}

// ─── Main Composition ───
export const CrazyScene: React.FC<CrazyWebGPUSceneProps> = (props) => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();

    let phaseStr = "P1: FLOCKING / FRACTAL TUNNEL";
    if (frame >= 100 && frame < 200) phaseStr = "P2: ORBITAL / MEGASPHERE";
    if (frame >= 200) phaseStr = "P3: LATTICE / INFINITE GRID";

    if (frame > 90 && frame < 110) phaseStr = "TRANSITION OVERRIDE...";
    if (frame > 190 && frame < 210) phaseStr = "TRANSITION OVERRIDE...";

    return (
        <AbsoluteFill style={{ background: "#000" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <SceneWithPhasesAndTransitions props={props} />
            </ThreeCanvas>

            <div
                style={{
                    position: "absolute",
                    top: 40,
                    left: 40,
                    fontFamily: "monospace",
                    fontSize: 24,
                    color: "#00ffcc",
                    textShadow: "0 0 10px #00ffcc"
                }}
            >
                SYS.CORE.COMPUTE_OVERRIDE_ENABLED
            </div>
            <div
                style={{
                    position: "absolute",
                    bottom: 40,
                    left: 40,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "sans-serif",
                    fontSize: 16
                }}
            >
                FRAME {frame} // BOIDS: {props.particleCount} // {phaseStr}
            </div>
        </AbsoluteFill>
    );
};
