import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uv,
    uniform,
    float,
    vec2,
    positionLocal,
    mx_noise_float,
    checker,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import type { WebGPUSceneProps } from "../../schemas";

export function ProceduralTorus({
    params,
    rotationSpeed,
}: {
    params: WebGPUSceneProps["proceduralTorus"];
    rotationSpeed: number;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU, colAU, colBU, checkerScaleU, distortionU } = useMemo(() => {
        const timeU = uniform(float(0));
        const colAU = uniform(color(params.colorA));
        const colBU = uniform(color(params.colorB));
        const checkerScaleU = uniform(float(params.checkerScale));
        const distortionU = uniform(float(params.noiseDistortion));

        const mat = new THREE.MeshStandardNodeMaterial();
        const uvCoord = uv();
        const noiseVal = mx_noise_float(uvCoord.mul(8.0).add(vec2(timeU.mul(0.5), 0)));
        const distortedUV = uvCoord.mul(checkerScaleU).add(noiseVal.mul(distortionU));
        const check = checker(distortedUV);
        mat.colorNode = mix(colAU, colBU, check);
        mat.roughnessNode = mix(float(0.8), float(0.1), check);
        mat.metalnessNode = mix(float(0.0), float(0.9), check);
        return { material: mat, timeU, colAU, colBU, checkerScaleU, distortionU };
    }, []);

    const t = frame / fps;
    timeU.value = t;
    colAU.value.set(params.colorA);
    colBU.value.set(params.colorB);
    checkerScaleU.value = params.checkerScale;
    distortionU.value = params.noiseDistortion;

    const rotX = Math.PI / 4 + t * 0.3 * rotationSpeed;
    const rotY = t * 0.5 * rotationSpeed;

    return (
        <mesh rotation={[rotX, rotY, 0]} material={material}>
            <torusGeometry args={[1.0, 0.4, 64, 128]} />
        </mesh>
    );
}
