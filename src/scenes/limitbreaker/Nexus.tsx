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
    mx_fractal_noise_vec3,
    clamp,
    length,
    instanceIndex,
} from "three/tsl";
import { useCurrentFrame, interpolate } from "remotion";
import { useMemo } from "react";
import { hashSeed } from "../../tsl";

export function Nexus() {
    const frame = useCurrentFrame();
    const COUNT = 50000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const id = float(instanceIndex);

        const seedX = hashSeed(id, 0);
        const seedY = hashSeed(id, 1);
        const seedZ = hashSeed(id, 2);

        const r = seedX.mul(3.0).add(2.0);
        const theta = seedY.mul(6.2832);
        const phi = seedZ.mul(3.1416);

        const initialPos = vec3(
            r.mul(sin(phi)).mul(cos(theta)),
            r.mul(cos(phi)),
            r.mul(sin(phi)).mul(sin(theta))
        );

        const t = timeU;
        const morphPhase = sin(t.mul(1.2)).mul(0.5).add(0.5);

        const flow = mx_fractal_noise_vec3(
            initialPos.mul(0.3).add(vec3(t.mul(0.15), t.mul(0.1), t.mul(0.12))),
            2, float(2.0), float(0.5), float(1.0)
        );

        const expandedPos = initialPos.add(flow.mul(morphPhase.mul(4.0)));

        const scale = seedX.mul(0.5).add(0.5);
        mat.positionNode = positionLocal.mul(scale).add(expandedPos);

        const speed = length(flow);
        const slowColor = color("#0044ff");
        const medColor = color("#00ffaa");
        const fastColor = color("#ffff00");
        const hotColor = color("#ffffff");

        const colorMix1 = mix(slowColor, medColor, clamp(speed.mul(2.0), 0.0, 1.0));
        const colorMix2 = mix(colorMix1, fastColor, clamp(speed.mul(2.0).sub(1.0), 0.0, 1.0));

        mat.colorNode = color("#000000");
        mat.emissiveNode = mix(colorMix2, hotColor, clamp(speed.mul(2.0).sub(2.0), 0.0, 1.0)).mul(1.5);
        mat.roughnessNode = float(0.3);
        mat.metalnessNode = float(0.8);

        return { material: mat, timeU };
    }, []);

    const t = interpolate(frame, [0, 89], [0, 8], { extrapolateRight: "clamp" });
    timeU.value = t;

    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 0.3]);

    return (
        <>
            <instancedMesh rotation={[0, rotY, 0]} args={[undefined, undefined, COUNT]} material={material}>
                <icosahedronGeometry args={[0.03, 0]} />
            </instancedMesh>
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
        </>
    );
}
