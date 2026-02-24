import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uv,
    uniform,
    float,
    sin,
    cos,
    vec3,
    vec2,
    positionLocal,
    normalLocal,
    normalWorld,
    cameraPosition,
    positionWorld,
    mx_noise_float,
    mx_fractal_noise_float,
    mx_fractal_noise_vec3,
    mx_worley_noise_float,
    normalize,
    dot,
    pow,
    abs,
    sub,
    mul,
    add,
    reflect,
    remap,
    step,
    smoothstep,
    fract,
    length,
    instanceIndex,
    positionGeometry,
    pointUV,
    If,
    Fn,
    Break,
    log,
    atan,
    acos,
    min,
    vec4
} from "three/tsl";
import { ThreeCanvas } from "@remotion/three";
import { WebGPUSync } from "../WebGPUSync";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { useMemo } from "react";
import { extend } from "@react-three/fiber";
import { BackendDetector, BackendOverlay, SceneLabel } from "../components";
import { useBackendDetection } from "../hooks";
import { createWebGPURenderer } from "../utils";
import { hashSeed } from "../tsl";

// Register three/webgpu classes with R3F
extend(THREE as any);

// ─── 1. Liquid Iridescent Plasma Blob ───
function LiquidPlasmaBlob() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        // Complex flowing 3D noise for vertex displacement
        const basePos = positionLocal.mul(1.5);
        const timeOffset = vec3(timeU.mul(0.3), timeU.mul(0.2), timeU.mul(0.5));
        const noiseInput = basePos.add(timeOffset);

        const displacement = mx_fractal_noise_float(noiseInput, 4, float(2.0), float(0.5), float(1.0));
        const pushDist = displacement.mul(0.6);

        // Displace position
        mat.positionNode = positionLocal.add(normalLocal.mul(pushDist));

        // Colors base on displacement + iridescence
        const purple = color("#9d00ff");
        const pink = color("#ff007f");
        const cyan = color("#00f0ff");

        // Mix colors via multiple noises
        const colorMix1 = mix(purple, pink, displacement.add(0.5).clamp());
        const colorMix2 = mix(colorMix1, cyan, sin(timeU.add(positionLocal.y.mul(2.0))).mul(0.5).add(0.5));

        mat.colorNode = colorMix2;
        mat.roughnessNode = float(0.0); // very smooth
        mat.metalnessNode = float(0.1);
        mat.transmission = 1.0; // Glass-like
        mat.thickness = 2.0;
        mat.ior = 1.6;

        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;
        mat.iridescenceThicknessNode = displacement.mul(200.0).add(300.0);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotX = t * 0.1;
    const rotY = t * 0.2;

    return (
        <mesh rotation={[rotX, rotY, 0]} material={material}>
            <sphereGeometry args={[1.5, 128, 128]} />
        </mesh>
    );
}

// ─── 2. Synthwave Neon Grid Terrain ───
function NeonTerrain() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.wireframe = false;

        // Displace vertices to form mountains that scroll towards camera
        const uvCoord = uv();
        const scrollSpeed = timeU.mul(0.5);
        const terrainPos = vec2(uvCoord.x.mul(10.0), uvCoord.y.mul(10.0).add(scrollSpeed));

        // Use layered noise for mountains
        const elevation = mx_fractal_noise_float(vec3(terrainPos.x, terrainPos.y, 0.0), 3, float(2.0), float(0.5), float(1.0));
        // Flatten valleys
        const height = pow(elevation.add(0.5).clamp(), 2.0).mul(2.0);

        mat.positionNode = positionLocal.add(vec3(0, 0, height)); // Plane is oriented so Z is up in geometry local space or Y depending on rotation, we assume standard PlaneGeometry (Z is normal). Wait, PlaneGeometry normal is Z.

        // Let's actually adjust based on normal to be standard
        mat.positionNode = positionLocal.add(normalLocal.mul(height));

        // Fragment Shader: Grid
        const gridScale = float(20.0);
        const gridUV = uvCoord.mul(gridScale);
        gridUV.y = gridUV.y.add(scrollSpeed.mul(gridScale.div(10.0))); // sync grid with terrain

        const gridX = fract(gridUV.x);
        const gridY = fract(gridUV.y);
        const lineX = smoothstep(0.0, 0.05, gridX).mul(smoothstep(1.0, 0.95, gridX));
        const lineY = smoothstep(0.0, 0.05, gridY).mul(smoothstep(1.0, 0.95, gridY));
        const gridLine = float(1.0).sub(lineX.mul(lineY));

        // Glow colors based on height
        const baseColor = color("#050015");
        const gridColor1 = color("#ff00ff"); // Magenta
        const gridColor2 = color("#00ffff"); // Cyan

        const heightColorMix = mix(gridColor1, gridColor2, elevation.add(0.5).clamp());

        mat.colorNode = baseColor;
        mat.emissiveNode = heightColorMix.mul(gridLine).mul(2.0); // Glow
        mat.roughnessNode = float(0.8);
        mat.metalnessNode = float(0.2);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    return (
        <mesh rotation={[-Math.PI / 2 + 0.2, 0, 0]} position={[0, -1, 0]} material={material}>
            <planeGeometry args={[20, 20, 128, 128]} />
        </mesh>
    );
}

// ─── 3. Flow-Field Particle Swarm ───
function FlowFieldSwarm() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const COUNT = 10000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        // Instances don't have built-in random per instance easily without setting attributes unless we hash the instanceIndex
        const id = float(instanceIndex);

        // Hash function to get random seed per particle
        const seedX = hashSeed(id, 0);
        const seedY = hashSeed(id, 1);
        const seedZ = hashSeed(id, 2);

        // Initial random position in a -5 to 5 sphere
        const initialPos = vec3(
            seedX.mul(10.0).sub(5.0),
            seedY.mul(10.0).sub(5.0),
            seedZ.mul(10.0).sub(5.0)
        );

        // Apply flow field (curl noise approximation) advection over 'time'
        // To make them actually move over time without state, we calculate a path based on time
        // We sample noise based on initial position + time
        const flow1 = mx_fractal_noise_vec3(initialPos.mul(0.5).add(vec3(timeU.mul(0.2), 0, 0)), 2, float(2.0), float(0.5), float(1.0));
        const flow2 = mx_fractal_noise_vec3(initialPos.mul(0.3).add(vec3(0, timeU.mul(0.3), 0)), 2, float(2.0), float(0.5), float(1.0));

        const animatedPos = initialPos.add(flow1.mul(3.0)).add(flow2.mul(2.0));

        mat.positionNode = positionLocal.add(animatedPos);

        // Color based on velocity/flow vectors
        const speed = length(flow1);
        const colorSlow = color("#0000ff");
        const colorFast = color("#ffff00");
        const particleColor = mix(colorSlow, colorFast, speed.clamp());

        mat.colorNode = color("#000000");
        mat.emissiveNode = particleColor.mul(2.0); // Make them glow
        mat.roughnessNode = float(0.2);
        mat.metalnessNode = float(1.0);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotY = t * 0.1;

    return (
        <instancedMesh rotation={[0, rotY, 0]} args={[undefined, undefined, COUNT]} material={material}>
            <dodecahedronGeometry args={[0.04, 0]} />
        </instancedMesh>
    );
}

// ─── 4. Galactic Point Cloud Nebula ───
function PointCloudNebula() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { geometry, material, timeU } = useMemo(() => {
        // 1. Create geometry
        const PARTICLE_COUNT = 50000;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Randomly scatter in a flat disk
            const r = 10.0 * Math.pow(Math.random(), 0.5); // uniform disk area roughly
            const theta = Math.random() * Math.PI * 2.0;

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5; // slight thickness
            positions[i * 3 + 2] = r * Math.sin(theta);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // 2. Create TSL Node Material for Points
        const timeU = uniform(float(0));
        const mat = new THREE.PointsNodeMaterial({ size: 0.1 });
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        // Radius from center
        const dist = length(positionLocal);

        // Rotate points based on distance (galactic shear)
        const angle = dist.mul(0.5).sub(timeU.mul(0.3));
        const rotX = positionLocal.x.mul(cos(angle)).sub(positionLocal.z.mul(sin(angle)));
        const rotZ = positionLocal.x.mul(sin(angle)).add(positionLocal.z.mul(cos(angle)));

        // Add some noise offset on Y based on position and time
        const noiseY = mx_fractal_noise_float(vec3(rotX, positionLocal.y, rotZ).mul(0.5).add(vec3(0, timeU.mul(0.5), 0)), 2, float(2.0), float(0.5), float(1.0));

        mat.positionNode = vec3(rotX, positionLocal.y.add(noiseY.mul(2.0)), rotZ);

        // Color gradient based on distance from core
        const coreColor = color("#ffffff");
        const midColor = color("#ff007f"); // Hot pink
        const outerColor = color("#000522"); // Dark blue

        const normalizedDist = dist.div(10.0).clamp();
        const colorMix1 = mix(coreColor, midColor, normalizedDist.mul(2.0).clamp());
        const finalColorInfo = mix(colorMix1, outerColor, sub(normalizedDist.mul(2.0), 1.0).clamp());

        mat.colorNode = finalColorInfo;

        // Procedural soft particle sprite
        // pointUV goes from 0 to 1 across the point sprite
        const pCenter = sub(pointUV, vec2(0.5));
        const pDist = length(pCenter);
        const alpha = sub(1.0, pDist.mul(2.0)).clamp(); // Creates a soft circle
        // Multiply alpha by opacity node
        mat.opacityNode = alpha.pow(2.0); // Smooth falloff

        return { geometry: geo, material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotX = Math.PI * 0.15;
    const rotY = t * 0.05;

    return (
        <points rotation={[rotX, rotY, 0]} geometry={geometry} material={material} />
    );
}

// ─── 5. Mandelbulb Raymarcher (God-Tier TSL) ───
function MandelbulbRaymarcher() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.BackSide;
        mat.depthWrite = false;

        mat.colorNode = Fn(() => {
            const pcoord = uv().mul(2.0).sub(1.0);
            pcoord.x = pcoord.x.mul(1920.0 / 1080.0);

            const ro = vec3(0.0, 0.0, -2.5);
            const rd = normalize(vec3(pcoord, 1.0));

            const dO = float(0.0).toVar();
            const power = sin(timeU).mul(2.0).add(6.0); // Animate power 4 to 8

            const marchSteps = 60;
            const trap = vec4(1000.0).toVar();

            for (let i = 0; i < marchSteps; i++) {
                const p = ro.add(rd.mul(dO));

                // Rotation
                const t = timeU.mul(0.2);
                const rotP = vec3(
                    p.x.mul(cos(t)).sub(p.z.mul(sin(t))),
                    p.y,
                    p.x.mul(sin(t)).add(p.z.mul(cos(t)))
                );

                // Mandelbulb SDF Z^n + C
                const z = rotP.toVar();
                const dr = float(1.0).toVar();
                const r = float(0.0).toVar();

                let escaped = false;
                for (let j = 0; j < 8; j++) {
                    r.assign(length(z));
                    If(r.greaterThan(2.0), () => Break());

                    const theta = acos(z.y.div(r));
                    const phi = atan(z.x, z.z);

                    dr.assign(pow(r, power.sub(1.0)).mul(power).mul(dr).add(1.0));

                    const zr = pow(r, power);
                    const newTheta = theta.mul(power);
                    const newPhi = phi.mul(power);

                    z.assign(vec3(
                        sin(newTheta).mul(cos(newPhi)),
                        cos(newTheta),
                        sin(newTheta).mul(sin(newPhi))
                    ).mul(zr).add(rotP));

                    trap.assign(min(trap, vec4(z.x, z.y, z.z, r)));
                }

                const d = r.mul(log(r)).mul(0.5).div(dr);
                dO.addAssign(d);
            }

            // Coloring based on orbit trap and distance
            const hitMask = step(dO, 10.0); // Did we hit the fractal before max distance?
            const bg = color("#000000");

            // Neon fractal glowing based on trap
            const trapColor = mix(
                color("#ff0033"),
                color("#00ffff"),
                fract(trap.x.add(trap.y).add(trap.z))
            );

            const intensity = remap(dO, 1.0, 3.0, 1.0, 0.0).clamp();
            const finalColor = trapColor.mul(intensity).mul(1.5).add(0.1);

            return vec4(mix(bg, finalColor, hitMask), 1.0);
        })();

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    return (
        <mesh>
            <boxGeometry args={[40, 40, 40]} />
            <meshBasicMaterial color="#000" />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

// ─── 6. Quantum Geometry Morphing (100k Particles) ───
function QuantumMorphingSwarm() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const COUNT = 100000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const id = float(instanceIndex);
        const t = timeU;

        // 1: Sphere (Fibonacci lattice)
        const phiS = id.mul(Math.PI * (3.0 - Math.sqrt(5.0)));
        const yS = float(1.0).sub(id.div(100000.0).mul(2.0));
        const radiusS = pow(float(1.0).sub(yS.mul(yS)), 0.5);
        const spherePos = vec3(cos(phiS).mul(radiusS), yS, sin(phiS).mul(radiusS)).mul(2.5);

        // 2: Torus
        const uT = fract(id.div(316.0)).mul(Math.PI * 2.0);
        const vT = id.div(100000.0).mul(Math.PI * 2.0);
        const rT = float(2.0);
        const cT = float(0.8);
        const torusPos = vec3(
            rT.add(cT.mul(cos(vT))).mul(cos(uT)),
            cT.mul(sin(vT)),
            rT.add(cT.mul(cos(vT))).mul(sin(uT))
        );

        // 3: Moebius Strip
        const uM = fract(id.div(316.0)).mul(Math.PI * 2.0);
        const vM = id.div(100000.0).mul(2.0).sub(1.0);
        const moebiusRadius = float(1.0).add(vM.mul(0.5).mul(cos(uM.mul(0.5))));
        const moebiusPos = vec3(
            cos(uM).mul(moebiusRadius),
            sin(uM).mul(moebiusRadius),
            vM.mul(0.5).mul(sin(uM.mul(0.5)))
        ).mul(2.0);

        // Animation logic 
        // 3 stages, each taking 1/3 of the loop
        const animDist = t.mul(0.5).mod(3.0);
        const isStage1 = step(animDist, 1.0);
        const isStage2 = step(1.0, animDist).mul(step(animDist, 2.0));
        const isStage3 = step(2.0, animDist);

        const localT = fract(animDist);
        // Add a smooth breathing effect to the transition
        const smoothT = smoothstep(0.0, 1.0, smoothstep(0.0, 1.0, localT));

        const pos = vec3(0).toVar();
        If(isStage1.greaterThan(0), () => pos.assign(mix(spherePos, torusPos, smoothT)));
        If(isStage2.greaterThan(0), () => pos.assign(mix(torusPos, moebiusPos, smoothT)));
        If(isStage3.greaterThan(0), () => pos.assign(mix(moebiusPos, spherePos, smoothT)));

        // Add some localized organic noise breathing
        const organicNoise = mx_fractal_noise_vec3(pos.mul(2.0).add(t), 2, float(2.0), float(0.5), float(1.0));

        mat.positionNode = positionLocal.add(pos).add(organicNoise.mul(0.1));

        // Colors based on current morph state
        const color1 = color("#00ff88");
        const color2 = color("#ff007f");
        const color3 = color("#00aaff");

        const mixedColor = vec3(0).toVar();
        If(isStage1.greaterThan(0), () => mixedColor.assign(mix(color1, color2, smoothT)));
        If(isStage2.greaterThan(0), () => mixedColor.assign(mix(color2, color3, smoothT)));
        If(isStage3.greaterThan(0), () => mixedColor.assign(mix(color3, color1, smoothT)));

        mat.colorNode = color("#000000");
        mat.emissiveNode = mixedColor.mul(1.5);
        mat.roughnessNode = float(0.1);
        mat.metalnessNode = float(0.9);
        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotX = t * 0.2;
    const rotY = t * 0.3;
    const rotZ = t * 0.1;

    return (
        <instancedMesh rotation={[rotX, rotY, rotZ]} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.015, 4, 4]} />
        </instancedMesh>
    );
}

// ─── Scene Setup ───
function SceneSetup({ children, onBackend }: { children: React.ReactNode; onBackend: (info: string) => void }) {
    return (
        <>
            <BackendDetector onDetect={onBackend} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#4488ff" />
            {children}
        </>
    );
}

const SCENE_LABELS = [
    "1/6: Liquid Iridescent Plasma Blob",
    "2/6: Synthwave Neon Grid Terrain",
    "3/6: Flow-Field GPU Particle Swarm",
    "4/6: Galactic Point Cloud Nebula",
    "5/6: Mandelbulb Raymarcher",
    "6/6: Quantum Geometry Morphing",
];

// ─── Main Composition ───
export const ExtraordinaryWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 50), 5);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 7], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <SceneSetup onBackend={onDetect}>
                    <Sequence from={0} durationInFrames={50} layout="none">
                        <LiquidPlasmaBlob />
                    </Sequence>
                    <Sequence from={50} durationInFrames={50} layout="none">
                        <NeonTerrain />
                    </Sequence>
                    <Sequence from={100} durationInFrames={50} layout="none">
                        <FlowFieldSwarm />
                    </Sequence>
                    <Sequence from={150} durationInFrames={50} layout="none">
                        <PointCloudNebula />
                    </Sequence>
                    <Sequence from={200} durationInFrames={50} layout="none">
                        <MandelbulbRaymarcher />
                    </Sequence>
                    <Sequence from={250} durationInFrames={50} layout="none">
                        <QuantumMorphingSwarm />
                    </Sequence>
                </SceneSetup>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />
        </AbsoluteFill>
    );
};
