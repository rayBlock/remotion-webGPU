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
    mx_fractal_noise_vec3,
    pow,
    step,
    smoothstep,
    instanceIndex,
    storage,
    Fn,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { ParticleForgeProps } from "../../schemas";
import { hashSeed } from "../../tsl";

export function SpiralGalaxy({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.galaxyParticles;

    const { computeNode, timeU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);
            const seedD = hashSeed(id, 3);

            const r = seedA.mul(seedA).mul(5.0).add(0.1);

            const arm = step(0.5, seedB).mul(3.14159);

            const baseAngle = seedC.mul(6.2832);
            const armOffset = arm.add(r.mul(float(props.galaxyArmTightness)));

            const orbitalSpeed = float(2.5).div(r.add(0.3).pow(0.5));
            const angle = baseAngle.add(armOffset).add(orbitalSpeed.mul(timeU));

            const diskHeight = seedD.sub(0.5).mul(0.15).mul(float(1.0).div(r.add(0.5)));

            const noiseInput = vec3(r.mul(cos(angle)), diskHeight, r.mul(sin(angle))).mul(0.5);
            const perturbation = mx_fractal_noise_vec3(noiseInput.add(vec3(timeU.mul(0.05), 0, 0)), 2, float(2.0), float(0.5), float(1.0));

            const x = r.mul(cos(angle)).add(perturbation.x.mul(0.2));
            const y = diskHeight.add(perturbation.y.mul(0.1));
            const z = r.mul(sin(angle)).add(perturbation.z.mul(0.2));

            pos.assign(vec4(x, y, z, r));
        });

        const computeNode = computeFn().compute(COUNT);

        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

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

        const brightness = float(1.5).div(r_val.add(0.3));
        mat.colorNode = galaxyColor.mul(brightness.clamp(0.3, 2.0));

        return { computeNode, timeU, material: mat };
    }, [props.galaxyParticles, props.galaxyArmTightness, props.galaxyCoreColor, props.galaxyMidColor, props.galaxyOuterColor, props.galaxyEdgeColor]);

    timeU.value = frame / fps;

    useEffect(() => {
        (gl as any).computeAsync(computeNode);
    }, [frame, gl, computeNode]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.008, 3, 2]} />
        </instancedMesh>
    );
}
