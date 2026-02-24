import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    positionLocal,
    mx_fractal_noise_vec3,
    length,
    instanceIndex,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { hashSeed } from "../../tsl";

export function FlowFieldSwarm() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const COUNT = 10000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const id = float(instanceIndex);

        const seedX = hashSeed(id, 0);
        const seedY = hashSeed(id, 1);
        const seedZ = hashSeed(id, 2);

        const initialPos = vec3(
            seedX.mul(10.0).sub(5.0),
            seedY.mul(10.0).sub(5.0),
            seedZ.mul(10.0).sub(5.0)
        );

        const flow1 = mx_fractal_noise_vec3(initialPos.mul(0.5).add(vec3(timeU.mul(0.2), 0, 0)), 2, float(2.0), float(0.5), float(1.0));
        const flow2 = mx_fractal_noise_vec3(initialPos.mul(0.3).add(vec3(0, timeU.mul(0.3), 0)), 2, float(2.0), float(0.5), float(1.0));

        const animatedPos = initialPos.add(flow1.mul(3.0)).add(flow2.mul(2.0));

        mat.positionNode = positionLocal.add(animatedPos);

        const speed = length(flow1);
        const colorSlow = color("#0000ff");
        const colorFast = color("#ffff00");
        const particleColor = mix(colorSlow, colorFast, speed.clamp());

        mat.colorNode = color("#000000");
        mat.emissiveNode = particleColor.mul(2.0);
        mat.roughnessNode = float(0.2);
        mat.metalnessNode = float(1.0);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotY = t * 0.1;

    return (
        <instancedMesh rotation={[0, rotY, 0]} args={[undefined, undefined, COUNT]} material={material}>
            <dodecahedronGeometry args={[0.04, 0]} />
        </instancedMesh>
    );
}
