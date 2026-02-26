import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    vec4,
    positionLocal,
    mx_fractal_noise_vec3,
    smoothstep,
    length,
    instanceIndex,
    storage,
    Fn,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { ParticleForgeProps } from "../../schemas";
import { hashSeed } from "../../tsl";

export function FlowField({ props }: { props: ParticleForgeProps }) {
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

            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

            const basePos = vec3(
                seedA.sub(0.5).mul(6.0),
                seedB.sub(0.5).mul(6.0),
                seedC.sub(0.5).mul(6.0)
            );

            const flowInput = basePos.mul(0.3).add(vec3(timeU.mul(0.1), timeU.mul(0.08), timeU.mul(0.06)));
            const largeFlow = mx_fractal_noise_vec3(flowInput, 3, float(2.0), float(0.5), float(1.0));

            const fineInput = basePos.mul(0.8).add(vec3(timeU.mul(0.15), 0, timeU.mul(0.12)));
            const fineFlow = mx_fractal_noise_vec3(fineInput, 2, float(2.0), float(0.5), float(1.0));

            const displaced = basePos.add(largeFlow.mul(2.0)).add(fineFlow.mul(0.5));

            const eps = float(0.01);
            const flowInputFwd = basePos.mul(0.3).add(vec3(timeU.add(eps).mul(0.1), timeU.add(eps).mul(0.08), timeU.add(eps).mul(0.06)));
            const largeFlowFwd = mx_fractal_noise_vec3(flowInputFwd, 3, float(2.0), float(0.5), float(1.0));
            const velocity = largeFlowFwd.sub(largeFlow).div(eps);
            const speed = length(velocity);

            pos.assign(vec4(displaced, speed));
        });

        const computeNode = computeFn().compute(COUNT);

        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

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
