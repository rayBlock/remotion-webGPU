import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    positionLocal,
    normalWorld,
    cameraPosition,
    positionWorld,
    mx_worley_noise_float,
    normalize,
    dot,
    pow,
    abs,
    sub,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import type { WebGPUSceneProps } from "../../schemas";

export function FresnelCrystal({
    params,
    rotationSpeed,
}: {
    params: WebGPUSceneProps["fresnelCrystal"];
    rotationSpeed: number;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU, crystalU, rimU, baseU, fresnelPowU, worleyScaleU } = useMemo(() => {
        const timeU = uniform(float(0));
        const crystalU = uniform(color(params.crystalColor));
        const rimU = uniform(color(params.rimColor));
        const baseU = uniform(color(params.baseColor));
        const fresnelPowU = uniform(float(params.fresnelPower));
        const worleyScaleU = uniform(float(params.worleyScale));

        const mat = new THREE.MeshPhysicalNodeMaterial();
        const viewDir = normalize(sub(cameraPosition, positionWorld));
        const fresnel = pow(sub(float(1.0), abs(dot(normalWorld, viewDir))), fresnelPowU);
        const worleyInput = positionLocal.mul(worleyScaleU).add(vec3(timeU.mul(0.2), 0, 0));
        const worley = mx_worley_noise_float(worleyInput);
        const cellColor = mix(baseU, crystalU, worley);
        mat.colorNode = mix(cellColor, rimU, fresnel);
        mat.emissiveNode = rimU.mul(fresnel.mul(2.0));
        mat.roughnessNode = worley.mul(0.3);
        mat.metalnessNode = float(1.0);
        mat.transmission = params.transmission;
        mat.thickness = 1.0;
        mat.ior = params.ior;
        return { material: mat, timeU, crystalU, rimU, baseU, fresnelPowU, worleyScaleU };
    }, [params.transmission, params.ior]);

    const t = frame / fps;
    timeU.value = t;
    crystalU.value.set(params.crystalColor);
    rimU.value.set(params.rimColor);
    baseU.value.set(params.baseColor);
    fresnelPowU.value = params.fresnelPower;
    worleyScaleU.value = params.worleyScale;

    const rotX = t * 0.2 * rotationSpeed;
    const rotY = t * 0.4 * rotationSpeed;

    return (
        <mesh rotation={[rotX, rotY, 0]} material={material}>
            <dodecahedronGeometry args={[1.3, 2]} />
        </mesh>
    );
}
