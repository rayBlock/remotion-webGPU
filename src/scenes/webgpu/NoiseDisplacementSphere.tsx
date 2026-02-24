import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    positionLocal,
    normalLocal,
    mx_fractal_noise_float,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import type { WebGPUSceneProps } from "../../schemas";

export function NoiseDisplacementSphere({
    params,
    rotationSpeed,
}: {
    params: WebGPUSceneProps["noiseDisplacement"];
    rotationSpeed: number;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU, warmU, coolU, strengthU, scaleU } = useMemo(() => {
        const timeU = uniform(float(0));
        const warmU = uniform(color(params.warmColor));
        const coolU = uniform(color(params.coolColor));
        const strengthU = uniform(float(params.displacementStrength));
        const scaleU = uniform(float(params.noiseScale));

        const mat = new THREE.MeshPhysicalNodeMaterial();
        const noiseInput = positionLocal.mul(scaleU).add(vec3(0, 0, timeU));
        const displacement = mx_fractal_noise_float(
            noiseInput, params.octaves, float(2.0), float(0.5), float(1.0)
        );
        mat.positionNode = positionLocal.add(normalLocal.mul(displacement.mul(strengthU)));
        mat.colorNode = mix(coolU, warmU, displacement.add(0.5).clamp());
        mat.roughnessNode = float(params.roughness);
        mat.metalnessNode = float(params.metalness);
        if (params.iridescence) {
            mat.iridescence = 1.0;
            mat.iridescenceIOR = 1.5;
        }
        return { material: mat, timeU, warmU, coolU, strengthU, scaleU };
    }, [params.octaves, params.roughness, params.metalness, params.iridescence]);

    const t = frame / fps;
    timeU.value = t * 0.5;
    warmU.value.set(params.warmColor);
    coolU.value.set(params.coolColor);
    strengthU.value = params.displacementStrength;
    scaleU.value = params.noiseScale;

    const rotY = t * 0.3 * rotationSpeed;

    return (
        <mesh rotation={[0, rotY, 0]} material={material}>
            <icosahedronGeometry args={[1.5, 64]} />
        </mesh>
    );
}
