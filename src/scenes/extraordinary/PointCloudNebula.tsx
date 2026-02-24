import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec2,
    vec3,
    positionLocal,
    mx_fractal_noise_float,
    sin,
    cos,
    sub,
    length,
    pointUV,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";

export function PointCloudNebula() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { geometry, material, timeU } = useMemo(() => {
        const PARTICLE_COUNT = 50000;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const r = 10.0 * Math.pow(Math.random(), 0.5);
            const theta = Math.random() * Math.PI * 2.0;

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            positions[i * 3 + 2] = r * Math.sin(theta);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const timeU = uniform(float(0));
        const mat = new THREE.PointsNodeMaterial({ size: 0.1 });
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        const dist = length(positionLocal);

        const angle = dist.mul(0.5).sub(timeU.mul(0.3));
        const rotX = positionLocal.x.mul(cos(angle)).sub(positionLocal.z.mul(sin(angle)));
        const rotZ = positionLocal.x.mul(sin(angle)).add(positionLocal.z.mul(cos(angle)));

        const noiseY = mx_fractal_noise_float(vec3(rotX, positionLocal.y, rotZ).mul(0.5).add(vec3(0, timeU.mul(0.5), 0)), 2, float(2.0), float(0.5), float(1.0));

        mat.positionNode = vec3(rotX, positionLocal.y.add(noiseY.mul(2.0)), rotZ);

        const coreColor = color("#ffffff");
        const midColor = color("#ff007f");
        const outerColor = color("#000522");

        const normalizedDist = dist.div(10.0).clamp();
        const colorMix1 = mix(coreColor, midColor, normalizedDist.mul(2.0).clamp());
        const finalColorInfo = mix(colorMix1, outerColor, sub(normalizedDist.mul(2.0), 1.0).clamp());

        mat.colorNode = finalColorInfo;

        const pCenter = sub(pointUV, vec2(0.5));
        const pDist = length(pCenter);
        const alpha = sub(1.0, pDist.mul(2.0)).clamp();
        mat.opacityNode = alpha.pow(2.0);

        return { geometry: geo, material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    const rotXVal = Math.PI * 0.15;
    const rotY = t * 0.05;

    return (
        <points rotation={[rotXVal, rotY, 0]} geometry={geometry} material={material} />
    );
}
