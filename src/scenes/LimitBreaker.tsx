import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uv,
    uniform,
    float,
    int,
    sin,
    cos,
    vec2,
    vec3,
    vec4,
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
    max,
    min,
    clamp,
    step,
    smoothstep,
    length,
    fract,
    reflect,
    instanceIndex,
    screenUV,
    Fn,
    Loop,
    Break,
    Discard,
    select,
    hash,
    If,
} from "three/tsl";
import { ThreeCanvas } from "@remotion/three";
import { WebGPUSync } from "../WebGPUSync";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, interpolate, Easing } from "remotion";
import { useMemo } from "react";
import { extend } from "@react-three/fiber";
import { BackendDetector, BackendOverlay, SceneLabel } from "../components";
import { useBackendDetection } from "../hooks";
import { createWebGPURenderer } from "../utils";
import { hashSeed } from "../tsl";

extend(THREE as any);

// ═══════════════════════════════════════════════════════════════════
// SCENE 1: "Cosmic Forge" — Full SDF Ray Marching via fragmentNode
// ═══════════════════════════════════════════════════════════════════

function CosmicForge() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.DoubleSide;

        // Ray marching entirely in fragmentNode
        mat.colorNode = Fn(() => {
            const suv = screenUV;
            // Map UV to [-1, 1] with aspect ratio correction
            const aspect = float(1920.0 / 1080.0);
            const rd_xy = vec2(
                suv.x.sub(0.5).mul(2.0).mul(aspect),
                suv.y.sub(0.5).mul(2.0)
            );

            // Camera setup
            const ro = vec3(
                sin(timeU.mul(0.3)).mul(4.0),
                cos(timeU.mul(0.2)).mul(2.0),
                cos(timeU.mul(0.3)).mul(4.0)
            );
            const target = vec3(0, 0, 0);
            const forward = normalize(sub(target, ro));
            const right = normalize(vec3(forward.z, float(0), forward.x.negate()));
            const up = normalize(vec3(
                right.y.mul(forward.z).sub(right.z.mul(forward.y)),
                right.z.mul(forward.x).sub(right.x.mul(forward.z)),
                right.x.mul(forward.y).sub(right.y.mul(forward.x))
            ));
            const rd = normalize(
                right.mul(rd_xy.x).add(up.mul(rd_xy.y)).add(forward.mul(1.5))
            );

            // SDF primitives
            const sdSphere = Fn(([p_immutable, r]: [any, any]) => {
                const p = vec3(p_immutable).toVar();
                return length(p).sub(r);
            });

            const sdTorus = Fn(([p_immutable, t1, t2]: [any, any, any]) => {
                const p = vec3(p_immutable).toVar();
                const q = vec2(length(vec2(p.x, p.z)).sub(t1), p.y);
                return length(q).sub(t2);
            });

            const sdBox = Fn(([p_immutable, b_immutable]: [any, any]) => {
                const p = vec3(p_immutable).toVar();
                const b = vec3(b_immutable).toVar();
                const q = abs(p).sub(b);
                return length(max(q, 0.0)).add(min(max(q.x, max(q.y, q.z)), 0.0));
            });

            // Smooth union
            const smin = Fn(([a, b, k]: [any, any, any]) => {
                const h = clamp(float(0.5).add(float(0.5).mul(b.sub(a)).div(k)), 0.0, 1.0);
                return mix(b, a, h).sub(k.mul(h).mul(float(1.0).sub(h)));
            });

            // Scene SDF
            const sceneSDF = Fn(([p_immutable]: [any]) => {
                const p = vec3(p_immutable).toVar();
                const t = timeU;

                // Morphing sphere
                const spherePos = vec3(sin(t.mul(0.7)).mul(1.2), cos(t.mul(0.5)).mul(0.5), cos(t.mul(0.8)).mul(1.0));
                const d1 = sdSphere(p.sub(spherePos), float(0.8).add(sin(t.mul(2.0)).mul(0.15)));

                // Orbiting torus
                const torusPos = vec3(cos(t.mul(0.6)).mul(1.5), sin(t.mul(0.9)).mul(0.3), sin(t.mul(0.6)).mul(1.5));
                const d2 = sdTorus(p.sub(torusPos), float(0.6), float(0.2));

                // Rounded box
                const boxPos = vec3(cos(t.mul(0.4)).mul(-1.0), sin(t.mul(0.3)).mul(0.8), sin(t.mul(0.5)).mul(-0.5));
                const d3 = sdBox(p.sub(boxPos), vec3(0.5, 0.5, 0.5)).sub(0.08);

                // Smooth union all shapes
                const d12 = smin(d1, d2, float(0.5));
                return smin(d12, d3, float(0.4));
            });

            // Ray march
            const totalDist = float(0).toVar();
            const marchPos = vec3(ro).toVar();
            const hitDist = float(100.0).toVar();

            Loop(80, () => {
                const d = sceneSDF(marchPos);
                hitDist.assign(d);
                totalDist.addAssign(d);
                marchPos.addAssign(rd.mul(d));
                If(d.lessThan(0.001), () => {
                    Break();
                });
                If(totalDist.greaterThan(20.0), () => {
                    Break();
                });
            });

            // Normal estimation via central differences
            const eps = float(0.001);
            const calcNormal = Fn(([p_immutable]: [any]) => {
                const p = vec3(p_immutable).toVar();
                return normalize(vec3(
                    sceneSDF(p.add(vec3(eps, 0, 0))).sub(sceneSDF(p.sub(vec3(eps, 0, 0)))),
                    sceneSDF(p.add(vec3(0, eps, 0))).sub(sceneSDF(p.sub(vec3(0, eps, 0)))),
                    sceneSDF(p.add(vec3(0, 0, eps))).sub(sceneSDF(p.sub(vec3(0, 0, eps))))
                ));
            });

            // Lighting
            const n = calcNormal(marchPos);
            const lightDir = normalize(vec3(
                sin(timeU.mul(0.5)).mul(3.0),
                float(4.0),
                cos(timeU.mul(0.5)).mul(3.0)
            ));
            const diff = max(dot(n, lightDir), 0.0);
            const viewDir = normalize(sub(ro, marchPos));
            const halfDir = normalize(add(lightDir, viewDir));
            const spec = pow(max(dot(n, halfDir), 0.0), 64.0);
            const fresnel = pow(float(1.0).sub(max(dot(n, viewDir), 0.0)), 3.0);

            // AO approximation (sample a bit along normal)
            const aoSample = sceneSDF(marchPos.add(n.mul(0.1)));
            const ao = clamp(aoSample.mul(10.0), 0.0, 1.0);

            // Material color
            const baseCol = mix(
                color("#1a0533"),
                color("#ff4466"),
                fresnel
            );
            const lit = baseCol.mul(diff.mul(0.7).add(0.15)).add(
                color("#aaccff").mul(spec.mul(1.5))
            ).add(color("#ff6600").mul(fresnel.mul(0.4)));
            const withAO = lit.mul(ao.mul(0.7).add(0.3));

            // Distance fog/glow
            const fog = float(1.0).sub(clamp(totalDist.mul(0.08), 0.0, 1.0));

            // Background gradient
            const bgColor = mix(color("#020010"), color("#0a0030"), rd.y.mul(0.5).add(0.5));
            const starNoise = hash(float(rd.x.mul(1000.0).add(rd.y.mul(5000.0))));
            const stars = step(0.998, starNoise).mul(0.8);
            const bg = bgColor.add(stars);

            // Final composite
            const hit = step(hitDist, float(0.01));
            const finalColor = mix(bg, withAO, hit.mul(fog));

            // Glow from ray march proximity
            const glow = float(0.02).div(hitDist.add(0.02)).mul(float(1.0).sub(hit));
            return finalColor.add(color("#ff3300").mul(glow.mul(0.3)));
        })();

        return { material: mat, timeU };
    }, []);

    // Remotion drives the animation time — interpolate gives explicit control
    // 90 frames → 6s of shader time (camera orbit + SDF morphing)
    const t = interpolate(frame, [0, 89], [0, 6], { extrapolateRight: "clamp" });
    timeU.value = t;

    return (
        <mesh material={material}>
            <planeGeometry args={[2, 2]} />
        </mesh>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 2: "Omnimaterial" — Every MeshPhysicalNodeMaterial Property
// ═══════════════════════════════════════════════════════════════════

function Omnimaterial() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const t = timeU;
        const pos = positionLocal;
        const nrm = normalWorld;
        const viewDir = normalize(sub(cameraPosition, positionWorld));

        // ─── colorNode: 3-way noise-driven color blend ───
        const noiseA = mx_fractal_noise_float(pos.mul(2.0).add(vec3(t.mul(0.3), 0, 0)), 3, float(2.0), float(0.5), float(1.0));
        const noiseB = mx_worley_noise_float(pos.mul(3.0).add(vec3(0, t.mul(0.2), 0)));
        const c1 = color("#ff2266"); // hot pink
        const c2 = color("#2244ff"); // electric blue
        const c3 = color("#ffcc00"); // gold
        const mix1 = mix(c1, c2, noiseA.add(0.5).clamp());
        mat.colorNode = mix(mix1, c3, noiseB.clamp());

        // ─── roughnessNode: Worley noise mapped ───
        mat.roughnessNode = mx_worley_noise_float(pos.mul(4.0).add(vec3(0, 0, t.mul(0.1)))).mul(0.6).add(0.1);

        // ─── metalnessNode: animated sine gradient ───
        mat.metalnessNode = sin(pos.y.mul(3.0).add(t.mul(1.5))).mul(0.5).add(0.5);

        // ─── emissiveNode: pulsating glow ───
        const pulse = sin(t.mul(4.0)).mul(0.5).add(0.5);
        mat.emissiveNode = color("#ff4400").mul(pulse.mul(noiseA.add(0.5).clamp()).mul(0.6));

        // ─── normalNode: procedural bump from noise derivatives ───
        const bumpScale = float(0.15);
        const bumpEps = float(0.01);
        const bumpCenter = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)));
        const bumpDx = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)).add(vec3(bumpEps, 0, 0)));
        const bumpDy = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)).add(vec3(0, bumpEps, 0)));
        const bumpGrad = vec3(bumpDx.sub(bumpCenter), bumpDy.sub(bumpCenter), bumpEps).normalize();
        mat.normalNode = normalize(normalLocal.add(bumpGrad.mul(bumpScale)));

        // ─── positionNode: subtle vertex displacement ───
        const vertDisp = mx_fractal_noise_float(pos.mul(1.5).add(vec3(0, t.mul(0.4), 0)), 2, float(2.0), float(0.5), float(1.0));
        mat.positionNode = positionLocal.add(normalLocal.mul(vertDisp.mul(0.06)));

        // ─── clearcoatNode + clearcoatRoughnessNode ───
        mat.clearcoatNode = sin(t.mul(1.0).add(pos.x.mul(2.0))).mul(0.5).add(0.5);
        mat.clearcoatRoughnessNode = mx_worley_noise_float(pos.mul(5.0)).mul(0.3);

        // ─── iridescence ───
        mat.iridescenceNode = float(1.0);
        mat.iridescenceIORNode = sin(t.mul(0.5)).mul(0.3).add(1.5);
        mat.iridescenceThicknessNode = noiseA.mul(200.0).add(300.0);

        // ─── sheen ───
        mat.sheenNode = color("#8844ff").mul(sin(t.mul(0.8).add(pos.z.mul(3.0))).mul(0.5).add(0.5));
        mat.sheenRoughnessNode = float(0.4);

        // ─── transmission + thickness + IOR ───
        mat.transmissionNode = noiseB.mul(0.4);
        mat.thicknessNode = float(0.5);
        mat.iorNode = float(1.5);

        // ─── specular ───
        mat.specularIntensityNode = sin(pos.y.mul(5.0).add(t)).mul(0.4).add(0.6);
        mat.specularColorNode = color("#ffffff");

        // ─── anisotropy ───
        mat.anisotropyNode = sin(t.mul(0.6).add(pos.x.mul(4.0))).mul(0.5).add(0.5);

        // ─── dispersion ───
        mat.dispersionNode = float(0.3);

        return { material: mat, timeU };
    }, []);

    // Remotion drives animation — 90 frames → 10s shader time
    // Larger range compensates for small shader multipliers (0.1-0.5)
    const t = interpolate(frame, [0, 89], [0, 10], { extrapolateRight: "clamp" });
    timeU.value = t;

    // Rotation via declarative props — applied on first render, no ref timing issues
    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 0.8]);
    const rotX = Math.sin(t * 0.15) * 0.2;

    return (
        <>
            <mesh rotation={[rotX, rotY, 0]} material={material}>
                <torusKnotGeometry args={[1, 0.35, 256, 64]} />
            </mesh>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 5, 5]} intensity={1.5} />
            <directionalLight position={[-3, 2, -5]} intensity={0.6} color="#4488ff" />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 3: "Genesis" — Procedural Planet with Atmosphere
// ═══════════════════════════════════════════════════════════════════

function GenesisPlanet() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { planetMat, cloudMat, atmosMat, timeU } = useMemo(() => {
        const timeU = uniform(float(0));

        // ─── PLANET SURFACE ───
        const planetMat = new THREE.MeshPhysicalNodeMaterial();
        const pos = positionLocal;

        // Terrain heightmap: fractal noise
        const terrainInput = pos.mul(2.0).add(vec3(0.42, 1.37, 0.89)); // seed offset
        const terrain = mx_fractal_noise_float(terrainInput, 6, float(2.0), float(0.5), float(1.0));

        // Vertex displacement
        planetMat.positionNode = positionLocal.add(normalLocal.mul(terrain.mul(0.25)));

        // Color mapping via elevation thresholds
        const h = terrain.add(0.5); // remap ~ [0, 1]
        const deepOcean = color("#001144");
        const shallowWater = color("#006688");
        const beach = color("#ccbb77");
        const grass = color("#228833");
        const rock = color("#665544");
        const snow = color("#eeeeff");

        // Biome blending
        const t1 = smoothstep(0.3, 0.35, h);
        const t2 = smoothstep(0.4, 0.45, h);
        const t3 = smoothstep(0.5, 0.55, h);
        const t4 = smoothstep(0.65, 0.7, h);
        const t5 = smoothstep(0.8, 0.85, h);

        const col1 = mix(deepOcean, shallowWater, t1);
        const col2 = mix(col1, beach, t2);
        const col3 = mix(col2, grass, t3);
        const col4 = mix(col3, rock, t4);
        planetMat.colorNode = mix(col4, snow, t5);

        // Water is smooth, land is rough
        planetMat.roughnessNode = mix(float(0.1), float(0.7), t2);
        planetMat.metalnessNode = mix(float(0.3), float(0.0), t2);

        // ─── CLOUD LAYER ───
        const cloudMat = new THREE.MeshPhysicalNodeMaterial();
        cloudMat.transparent = true;
        cloudMat.side = THREE.DoubleSide;
        cloudMat.depthWrite = false;

        const cloudInput = positionLocal.mul(3.0).add(vec3(timeU.mul(0.05), timeU.mul(0.02), timeU.mul(0.03)));
        const cloudNoise = mx_fractal_noise_float(cloudInput, 4, float(2.0), float(0.5), float(1.0));
        const cloudDensity = smoothstep(0.0, 0.3, cloudNoise);

        cloudMat.colorNode = color("#ffffff");
        cloudMat.opacityNode = cloudDensity.mul(0.7);
        cloudMat.emissiveNode = color("#222222").mul(cloudDensity);

        // ─── ATMOSPHERE ───
        const atmosMat = new THREE.MeshPhysicalNodeMaterial();
        atmosMat.transparent = true;
        atmosMat.side = THREE.BackSide;
        atmosMat.depthWrite = false;

        const viewDir = normalize(sub(cameraPosition, positionWorld));
        const rim = float(1.0).sub(abs(dot(normalWorld, viewDir)));
        const atmosGlow = pow(rim, 3.0);

        atmosMat.colorNode = color("#000000");
        atmosMat.emissiveNode = mix(color("#4488ff"), color("#aaddff"), atmosGlow).mul(atmosGlow.mul(2.0));
        atmosMat.opacityNode = atmosGlow.mul(0.8);

        // Subtle pulse
        const atmosPulse = sin(timeU.mul(2.0)).mul(0.1).add(1.0);
        atmosMat.emissiveNode = (atmosMat.emissiveNode as any).mul(atmosPulse);

        return { planetMat, cloudMat, atmosMat, timeU };
    }, []);

    // Remotion drives animation — 90 frames → 8s shader time for cloud/atmos scroll
    const t = interpolate(frame, [0, 89], [0, 8], { extrapolateRight: "clamp" });
    timeU.value = t;

    // Rotation via declarative props — applied on first render, no ref timing issues
    const planetRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.5]);
    const cloudsRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.65]);
    const atmosRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.2]);

    return (
        <>
            <mesh rotation={[0, planetRotY, 0]} material={planetMat}>
                <sphereGeometry args={[1.5, 128, 128]} />
            </mesh>
            <mesh rotation={[0.1, cloudsRotY, 0]} material={cloudMat}>
                <sphereGeometry args={[1.55, 96, 96]} />
            </mesh>
            <mesh rotation={[0, atmosRotY, 0]} material={atmosMat}>
                <sphereGeometry args={[1.75, 64, 64]} />
            </mesh>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 3, 4]} intensity={1.8} />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 4: "Entropy" — Dissolving Mesh with Edge Glow + Discard()
// ═══════════════════════════════════════════════════════════════════

function Entropy() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU, progressU } = useMemo(() => {
        const timeU = uniform(float(0));
        const progressU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();
        mat.side = THREE.DoubleSide;

        const pos = positionLocal;

        // 3D noise for dissolution pattern
        const dissolveNoise = mx_fractal_noise_float(
            pos.mul(3.0).add(vec3(0.5, 1.2, 0.8)),
            4, float(2.0), float(0.5), float(1.0)
        );
        const noiseVal = dissolveNoise.add(0.5); // remap to ~[0,1]

        // Discard fragments where noise < progress
        const threshold = progressU;
        // Use Fn to wrap discard logic
        mat.colorNode = Fn(() => {
            // Discard dissolved fragments
            Discard(noiseVal.lessThan(threshold));

            // Edge detection: how close to the dissolve boundary
            const edgeDist = noiseVal.sub(threshold);
            const edgeWidth = float(0.08);
            const edgeIntensity = float(1.0).sub(smoothstep(0.0, edgeWidth, edgeDist));

            // Color shift: cool metallic → hot embers
            const coolColor = color("#667788");
            const hotColor = color("#ff4400");
            const emberColor = color("#ffcc00");

            const baseColor = mix(coolColor, hotColor, progressU);

            // Edge glow color: orange to white
            const edgeColor = mix(emberColor, color("#ffffff"), edgeIntensity);

            return mix(baseColor, edgeColor, edgeIntensity);
        })();

        // Emissive at edges for bloom-like glow
        mat.emissiveNode = Fn(() => {
            const edgeDist = noiseVal.sub(threshold);
            const edgeWidth = float(0.08);
            const edgeIntensity = float(1.0).sub(smoothstep(0.0, edgeWidth, edgeDist));
            return color("#ff6600").mul(edgeIntensity.mul(3.0));
        })();

        // Vertex displacement increases with progress (mesh warps)
        const warpNoise = mx_fractal_noise_float(
            pos.mul(2.0).add(vec3(timeU.mul(0.5), 0, 0)),
            2, float(2.0), float(0.5), float(1.0)
        );
        mat.positionNode = positionLocal.add(normalLocal.mul(warpNoise.mul(progressU.mul(0.5))));

        mat.roughnessNode = mix(float(0.2), float(0.8), progressU);
        mat.metalnessNode = mix(float(0.9), float(0.1), progressU);

        return { material: mat, timeU, progressU };
    }, []);

    // Remotion drives both time and progress independently
    const t = interpolate(frame, [0, 89], [0, 6], { extrapolateRight: "clamp" });
    timeU.value = t;
    // Progress ramp: 0→1 over the scene — this IS the dissolve animation
    progressU.value = interpolate(frame, [0, 85], [0, 1], { extrapolateRight: "clamp" });

    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 1.2]);
    const rotX = interpolate(frame, [0, 89], [0, Math.PI * 0.45]);

    return (
        <>
            <mesh rotation={[rotX, rotY, 0]} material={material}>
                <icosahedronGeometry args={[1.5, 64]} />
            </mesh>
            <ambientLight intensity={0.4} />
            <directionalLight position={[4, 5, 4]} intensity={1.5} />
            <directionalLight position={[-3, 2, -3]} intensity={0.5} color="#ff4400" />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SCENE 5: "Nexus" — 50K Instance Swarm with Flow Field
// ═══════════════════════════════════════════════════════════════════

function Nexus() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const COUNT = 50000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const id = float(instanceIndex);

        // Per-instance hash seeds
        const seedX = hashSeed(id, 0);
        const seedY = hashSeed(id, 1);
        const seedZ = hashSeed(id, 2);

        // Spherical shell distribution (r between 2 and 5)
        const r = seedX.mul(3.0).add(2.0);
        const theta = seedY.mul(6.2832); // 0 to 2pi
        const phi = seedZ.mul(3.1416); // 0 to pi

        const initialPos = vec3(
            r.mul(sin(phi)).mul(cos(theta)),
            r.mul(cos(phi)),
            r.mul(sin(phi)).mul(sin(theta))
        );

        // Formation morphing: sphere → expand → contract
        const t = timeU;
        const morphPhase = sin(t.mul(1.2)).mul(0.5).add(0.5); // 0→1→0

        // Flow field advection
        const flow = mx_fractal_noise_vec3(
            initialPos.mul(0.3).add(vec3(t.mul(0.15), t.mul(0.1), t.mul(0.12))),
            2, float(2.0), float(0.5), float(1.0)
        );

        const expandedPos = initialPos.add(flow.mul(morphPhase.mul(4.0)));

        // Per-instance scale (subtle variation)
        const scale = seedX.mul(0.5).add(0.5); // 0.5 to 1.0
        mat.positionNode = positionLocal.mul(scale).add(expandedPos);

        // Per-instance color based on velocity/flow magnitude
        const speed = length(flow);
        const slowColor = color("#0044ff");
        const medColor = color("#00ffaa");
        const fastColor = color("#ffff00");
        const hotColor = color("#ffffff");

        const colorMix1 = mix(slowColor, medColor, clamp(speed.mul(2.0), 0.0, 1.0));
        const colorMix2 = mix(colorMix1, fastColor, clamp(speed.mul(2.0).sub(1.0), 0.0, 1.0));

        mat.colorNode = color("#000000");
        mat.emissiveNode = mix(colorMix2, hotColor, clamp(speed.mul(2.0).sub(2.0), 0.0, 1.0)).mul(1.5);
        mat.roughnessNode = float(0.3);
        mat.metalnessNode = float(0.8);

        return { material: mat, timeU };
    }, []);

    // Remotion drives animation — 90 frames → 8s for flow field + morph phase
    const t = interpolate(frame, [0, 89], [0, 8], { extrapolateRight: "clamp" });
    timeU.value = t;

    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 0.3]);

    return (
        <>
            <instancedMesh rotation={[0, rotY, 0]} args={[undefined, undefined, COUNT]} material={material}>
                <icosahedronGeometry args={[0.03, 0]} />
            </instancedMesh>
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Scene labels
// ═══════════════════════════════════════════════════════════════════

const SCENE_LABELS = [
    "1/5: Cosmic Forge — SDF Ray Marching",
    "2/5: Omnimaterial — Every Physical Property",
    "3/5: Genesis — Procedural Planet",
    "4/5: Entropy — Dissolving Mesh + Discard()",
    "5/5: Nexus — 50K Instance Swarm",
];

// ═══════════════════════════════════════════════════════════════════
// Main Composition
// ═══════════════════════════════════════════════════════════════════

export const LimitBreaker: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 90), 4);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 5], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <BackendDetector onDetect={onDetect} />
                <Sequence from={0} durationInFrames={90} layout="none">
                    <CosmicForge />
                </Sequence>
                <Sequence from={90} durationInFrames={90} layout="none">
                    <Omnimaterial />
                </Sequence>
                <Sequence from={180} durationInFrames={90} layout="none">
                    <GenesisPlanet />
                </Sequence>
                <Sequence from={270} durationInFrames={90} layout="none">
                    <Entropy />
                </Sequence>
                <Sequence from={360} durationInFrames={90} layout="none">
                    <Nexus />
                </Sequence>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />
        </AbsoluteFill>
    );
};
