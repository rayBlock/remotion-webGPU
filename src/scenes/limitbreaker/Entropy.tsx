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
    smoothstep,
    Fn,
    Discard,
} from "three/tsl";
import { useCurrentFrame, interpolate } from "remotion";
import { useMemo } from "react";

export function Entropy() {
    const frame = useCurrentFrame();

    const { material, timeU, progressU } = useMemo(() => {
        const timeU = uniform(float(0));
        const progressU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();
        mat.side = THREE.DoubleSide;

        const pos = positionLocal;

        const dissolveNoise = mx_fractal_noise_float(
            pos.mul(3.0).add(vec3(0.5, 1.2, 0.8)),
            4, float(2.0), float(0.5), float(1.0)
        );
        const noiseVal = dissolveNoise.add(0.5);

        const threshold = progressU;
        mat.colorNode = Fn(() => {
            Discard(noiseVal.lessThan(threshold));

            const edgeDist = noiseVal.sub(threshold);
            const edgeWidth = float(0.08);
            const edgeIntensity = float(1.0).sub(smoothstep(0.0, edgeWidth, edgeDist));

            const coolColor = color("#667788");
            const hotColor = color("#ff4400");
            const emberColor = color("#ffcc00");

            const baseColor = mix(coolColor, hotColor, progressU);

            const edgeColor = mix(emberColor, color("#ffffff"), edgeIntensity);

            return mix(baseColor, edgeColor, edgeIntensity);
        })();

        mat.emissiveNode = Fn(() => {
            const edgeDist = noiseVal.sub(threshold);
            const edgeWidth = float(0.08);
            const edgeIntensity = float(1.0).sub(smoothstep(0.0, edgeWidth, edgeDist));
            return color("#ff6600").mul(edgeIntensity.mul(3.0));
        })();

        const warpNoise = mx_fractal_noise_float(
            pos.mul(2.0).add(vec3(timeU.mul(0.5), 0, 0)),
            2, float(2.0), float(0.5), float(1.0)
        );
        mat.positionNode = positionLocal.add(normalLocal.mul(warpNoise.mul(progressU.mul(0.5))));

        mat.roughnessNode = mix(float(0.2), float(0.8), progressU);
        mat.metalnessNode = mix(float(0.9), float(0.1), progressU);

        return { material: mat, timeU, progressU };
    }, []);

    const t = interpolate(frame, [0, 89], [0, 6], { extrapolateRight: "clamp" });
    timeU.value = t;
    progressU.value = interpolate(frame, [0, 85], [0, 1], { extrapolateRight: "clamp" });

    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 1.2]);
    const rotX = interpolate(frame, [0, 89], [0, Math.PI * 0.45]);

    return (
        <>
            <mesh rotation={[rotX, rotY, 0]} material={material}>
                <icosahedronGeometry args={[1.5, 64]} />
            </mesh>
            <ambientLight intensity={0.4} />
            <directionalLight position={[4, 5, 4]} intensity={1.5} />
            <directionalLight position={[-3, 2, -3]} intensity={0.5} color="#ff4400" />
        </>
    );
}
