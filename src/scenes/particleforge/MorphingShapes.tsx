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
    abs,
    step,
    smoothstep,
    fract,
    instanceIndex,
    storage,
    Fn,
    select,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { ParticleForgeProps } from "../../schemas";
import { hashSeed } from "../../tsl";

export function MorphingShapes({ props }: { props: ParticleForgeProps }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = props.morphParticles;

    const { computeNode, timeU, progressU, material } = useMemo(() => {
        const posData = new Float32Array(COUNT * 4);
        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(posData, 4), 'vec4', COUNT);

        const timeU = uniform(float(0));
        const progressU = uniform(float(0));

        const computeFn = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const id = float(instanceIndex);

            const seedA = hashSeed(id, 0);
            const seedB = hashSeed(id, 1);
            const seedC = hashSeed(id, 2);

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
            const helixStrand = step(0.5, seedB).mul(2.0).sub(1.0);
            const helix = vec3(
                cos(helixT).mul(helixStrand).mul(0.8),
                helixT.mul(0.3),
                sin(helixT).mul(helixStrand).mul(0.8)
            );

            const p = progressU;

            const t1 = smoothstep(0.0, 0.333, p);
            const t2 = smoothstep(0.333, 0.667, p);
            const t3 = smoothstep(0.667, 1.0, p);

            const pos1 = mix(sphere, cube, t1);
            const pos2 = mix(pos1, torus, t2);
            const basePos = mix(pos2, helix, t3);

            const transitionActivity = sin(p.mul(3.14159).mul(3.0)).abs().mul(0.8);
            const noise = mx_fractal_noise_vec3(
                vec3(id.mul(0.001), timeU.mul(0.3), float(0)),
                2, float(2.0), float(0.5), float(1.0)
            );
            const displaced = basePos.add(noise.mul(transitionActivity));

            const shapeIdx = select(p.lessThan(0.167), float(0.0),
                select(p.lessThan(0.5), float(1.0),
                    select(p.lessThan(0.833), float(2.0), float(3.0))
                )
            );

            pos.assign(vec4(displaced, shapeIdx));
        });

        const computeNode = computeFn().compute(COUNT);

        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const instancePos = posStorage.element(instanceIndex);
        mat.positionNode = positionLocal.add(instancePos.xyz);

        const shapeIdx = instancePos.w;
        const sphereColor = color(props.sphereColor);
        const cubeColor = color(props.cubeColor);
        const torusColor = color(props.torusColor);
        const helixColor = color(props.helixColor);

        const c1 = mix(sphereColor, cubeColor, smoothstep(0.0, 1.0, shapeIdx));
        const c2 = mix(c1, torusColor, smoothstep(1.0, 2.0, shapeIdx));
        mat.colorNode = mix(c2, helixColor, smoothstep(2.0, 3.0, shapeIdx)).mul(1.2);

        return { computeNode, timeU, progressU, material: mat };
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
