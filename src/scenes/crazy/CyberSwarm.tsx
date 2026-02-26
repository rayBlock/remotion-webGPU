import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    cos,
    vec3,
    positionLocal,
    mx_worley_noise_float,
    mx_fractal_noise_vec3,
    normalize,
    sub,
    length,
    instanceIndex,
    storage,
    Fn,
    If,
    select,
    smoothstep,
    step,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { CrazyWebGPUSceneProps } from "../../schemas";

function SwarmComputeSystem(props: CrazyWebGPUSceneProps, phaseNode: any) {
    const { gl } = useThree();

    const { positionBuffer, velocityBuffer, computeNode, localTime } = useMemo(() => {
        const P_COUNT = props.particleCount;
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

            If(phase.equal(0), () => {
                const target = vec3(sin(t.mul(0.5)).mul(4.0), cos(t.mul(0.3)).mul(2.0), sin(t.mul(0.4)).mul(3.0));
                const toTarget = normalize(sub(target, pos.xyz));

                const noiseOffset = vec3(0, t.mul(float(props.flowSpeed)), 0);
                const flow = mx_fractal_noise_vec3(pos.xyz.mul(float(props.flowNoiseScale)).add(noiseOffset), 2, float(2.0), float(0.5), float(1.0));

                force.assign(toTarget.mul(0.01).add(flow.mul(0.02)));
            });

            If(phase.equal(1), () => {
                const singularity = vec3(0, 0, 0);
                const toSingularity = sub(singularity, pos.xyz);
                const distToSingularity = length(toSingularity);

                const gravityStrength = float(20.0).div(distToSingularity.add(1.0).pow(2.0));

                const eventHorizonRadius = float(1.2);
                const pushback = smoothstep(eventHorizonRadius, eventHorizonRadius.sub(0.2), distToSingularity).mul(5.0);

                const gravity = normalize(toSingularity).mul(gravityStrength.sub(pushback));

                const up = vec3(0, 1, 0);
                const tangent = normalize(toSingularity.cross(up));
                const spinStrength = float(15.0).div(distToSingularity.add(0.5));

                const diskSquash = vec3(0, pos.y.mul(-0.1), 0);

                force.assign(gravity.add(tangent.mul(spinStrength)).add(diskSquash));
            });

            If(phase.equal(2), () => {
                const gridSize = float(0.5);
                const snappedPos = pos.xyz.div(gridSize).round().mul(gridSize);
                const pullToGrid = sub(snappedPos, pos.xyz);

                vel.xyz = vel.xyz.mul(0.9);
                force.assign(pullToGrid.mul(0.1));
            });

            let newVel = vel.xyz.add(force);

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

    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    localTime.value = frame / fps;

    useEffect(() => {
        (gl as any).compute(computeNode);
    }, [frame, gl, computeNode]);

    return { positionBuffer, velocityBuffer };
}

export function CyberSwarm({ props, phaseNode }: { props: CrazyWebGPUSceneProps, phaseNode: any }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { positionBuffer, velocityBuffer } = SwarmComputeSystem(props, phaseNode);

    const material = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial();
        const instancePos = positionBuffer.element(instanceIndex);
        const instanceVel = velocityBuffer.element(instanceIndex);

        const up = vec3(0, 1, 0);
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
