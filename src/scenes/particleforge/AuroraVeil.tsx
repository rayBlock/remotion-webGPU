import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    vec3,
    vec4,
    positionLocal,
    mx_fractal_noise_vec3,
    clamp,
    smoothstep,
    fract,
    instanceIndex,
    storage,
    Fn,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { ParticleForgeProps } from "../../schemas";
import { hashSeed } from "../../tsl";

export function AuroraVeil({ props }: { props: ParticleForgeProps }) {
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

            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

            const bandIdx = fract(id.mul(0.000037)).mul(8.0).floor();
            const bandY = bandIdx.mul(0.5).sub(1.75);

            const xPos = seedA.sub(0.5).mul(8.0);
            const zBase = seedB.sub(0.5).mul(2.0);

            const curtainWave = sin(xPos.mul(0.8).add(bandIdx.mul(1.2)).add(timeU.mul(0.5))).mul(0.6);

            const noiseInput = vec3(xPos.mul(0.3), bandY.mul(0.5), timeU.mul(0.15));
            const perturbation = mx_fractal_noise_vec3(noiseInput, 3, float(2.0), float(0.5), float(1.0));

            const yOffset = perturbation.y.mul(0.8).add(seedC.sub(0.5).mul(0.3));

            const travelWave = sin(xPos.mul(1.5).sub(timeU.mul(2.0)).add(bandIdx.mul(0.7)));
            const shimmer = travelWave.mul(0.5).add(0.5);

            const x = xPos.add(perturbation.x.mul(0.3));
            const y = bandY.add(yOffset);
            const z = zBase.add(curtainWave).add(perturbation.z.mul(0.3));

            const heightNorm = y.add(2.0).div(4.0).clamp(0.0, 1.0);
            pos.assign(vec4(x, y, z, heightNorm.mul(0.5).add(shimmer.mul(0.5))));
        });

        const computeNode = computeFn().compute(COUNT);

        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        const val = instancePos.w;
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
