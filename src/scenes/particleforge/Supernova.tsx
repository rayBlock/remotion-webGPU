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
    abs,
    smoothstep,
    fract,
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

export function Supernova({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.supernovaParticles;

    const { computeNode, progressU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const progressU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

            const theta = seedA.mul(6.2832);
            const phi = seedB.mul(3.14159);
            const dir = vec3(
                sin(phi).mul(cos(theta)),
                cos(phi),
                sin(phi).mul(sin(theta))
            );

            const speedVar = seedC.mul(0.6).add(0.4);

            const explodeT = smoothstep(0.0, 0.5, progressU);
            const explodeEase = float(1.0).sub(float(1.0).sub(explodeT).pow(2.0));
            const explodeRadius = explodeEase.mul(5.0).mul(speedVar);
            const explodePos = dir.mul(explodeRadius);

            const implodeT = smoothstep(0.5, 1.0, progressU);

            const shellR = float(1.8);
            const quantTheta = fract(seedA.mul(20.0)).mul(6.2832);
            const quantPhi = fract(seedB.mul(12.0)).mul(3.14159);
            const shellPos = vec3(
                sin(quantPhi).mul(cos(quantTheta)).mul(shellR),
                cos(quantPhi).mul(shellR),
                sin(quantPhi).mul(sin(quantTheta)).mul(shellR)
            );

            const finalPos = mix(explodePos, shellPos, implodeT);

            const dist = length(finalPos);

            pos.assign(vec4(finalPos, dist));
        });

        const computeNode = computeFn().compute(COUNT);

        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        const p = progressU;
        const hotWhite = color(props.supernovaHotColor);
        const emberOrange = color(props.supernovaEmberColor);
        const coolBlue = color(props.supernovaCoolColor);
        const crystalWhite = color("#ccddff");

        const phaseColor = mix(hotWhite, emberOrange, smoothstep(0.0, 0.4, p));
        const finalColor = mix(phaseColor, mix(coolBlue, crystalWhite, smoothstep(0.7, 1.0, p)), smoothstep(0.4, 0.8, p));

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
