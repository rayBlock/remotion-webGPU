import * as THREE from "three/webgpu";
import {
    color,
    uniform,
    float,
    sin,
    cos,
    vec3,
    positionLocal,
    normalWorld,
    cameraPosition,
    positionWorld,
    normalize,
    dot,
    sub,
    fract,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import type { WebGPUSceneProps } from "../../schemas";

export function HolographicRibbon({
    params,
    rotationSpeed,
}: {
    params: WebGPUSceneProps["holographicRibbon"];
    rotationSpeed: number;
}) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, timeU, ampU, freqU, rainbowSpeedU, emissiveStrU } = useMemo(() => {
        const timeU = uniform(float(0));
        const ampU = uniform(float(params.waveAmplitude));
        const freqU = uniform(float(params.waveFrequency));
        const rainbowSpeedU = uniform(float(params.rainbowSpeed));
        const emissiveStrU = uniform(float(params.emissiveStrength));

        const mat = new THREE.MeshPhysicalNodeMaterial();
        mat.side = THREE.DoubleSide;

        const wave1 = sin(positionLocal.x.mul(freqU).add(timeU.mul(3.0))).mul(ampU);
        const wave2 = cos(positionLocal.z.mul(freqU.mul(0.75)).add(timeU.mul(2.0))).mul(ampU.mul(0.67));
        mat.positionNode = positionLocal.add(vec3(0, wave1.add(wave2), 0));

        const viewDir = normalize(sub(cameraPosition, positionWorld));
        const rim = dot(normalWorld, viewDir);
        const hue = fract(rim.abs().add(positionWorld.x.mul(0.3)).add(timeU.mul(rainbowSpeedU)));
        const r = sin(hue.mul(6.2832)).mul(0.5).add(0.5);
        const g = sin(hue.mul(6.2832).add(2.094)).mul(0.5).add(0.5);
        const b = sin(hue.mul(6.2832).add(4.189)).mul(0.5).add(0.5);
        mat.colorNode = vec3(r, g, b);
        mat.emissiveNode = vec3(r, g, b).mul(emissiveStrU);
        mat.roughnessNode = float(0.1);
        mat.metalnessNode = float(1.0);
        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;
        return { material: mat, timeU, ampU, freqU, rainbowSpeedU, emissiveStrU };
    }, []);

    const t = frame / fps;
    timeU.value = t;
    ampU.value = params.waveAmplitude;
    freqU.value = params.waveFrequency;
    rainbowSpeedU.value = params.rainbowSpeed;
    emissiveStrU.value = params.emissiveStrength;

    const rotY = t * 0.6 * rotationSpeed;

    return (
        <mesh rotation={[0, rotY, 0]} material={material}>
            <planeGeometry args={[4, 2, 128, 64]} />
        </mesh>
    );
}
