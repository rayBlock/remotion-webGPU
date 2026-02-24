import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    cos,
    vec2,
    vec3,
    positionLocal,
    mx_fractal_noise_float,
    sub,
    length,
    pointUV
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";

export function PointCloudNebula() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const pointsRef = useRef<THREE.Points>(null);

    const { geometry, material, timeU } = useMemo(() => {
        // 1. Create geometry
        const PARTICLE_COUNT = 50000;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Randomly scatter in a flat disk
            const r = 10.0 * Math.pow(Math.random(), 0.5); // uniform disk area roughly
            const theta = Math.random() * Math.PI * 2.0;

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5; // slight thickness
            positions[i * 3 + 2] = r * Math.sin(theta);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // 2. Create TSL Node Material for Points
        const timeU = uniform(float(0));
        const mat = new THREE.PointsNodeMaterial({ size: 0.1 });
        mat.transparent = true;
        mat.depthWrite = false;
        mat.blending = THREE.AdditiveBlending;

        // Radius from center
        const dist = length(positionLocal);

        // Rotate points based on distance (galactic shear)
        const angle = dist.mul(0.5).sub(timeU.mul(0.3));
        const rotX = positionLocal.x.mul(cos(angle)).sub(positionLocal.z.mul(sin(angle)));
        const rotZ = positionLocal.x.mul(sin(angle)).add(positionLocal.z.mul(cos(angle)));

        // Add some noise offset on Y based on position and time
        const noiseY = mx_fractal_noise_float(vec3(rotX, positionLocal.y, rotZ).mul(0.5).add(vec3(0, timeU.mul(0.5), 0)), 2, float(2.0), float(0.5), float(1.0));

        mat.positionNode = vec3(rotX, positionLocal.y.add(noiseY.mul(2.0)), rotZ);

        // Color gradient based on distance from core
        const coreColor = color("#ffffff");
        const midColor = color("#ff007f"); // Hot pink
        const outerColor = color("#000522"); // Dark blue

        const normalizedDist = dist.div(10.0).clamp();
        const colorMix1 = mix(coreColor, midColor, normalizedDist.mul(2.0).clamp());
        const finalColorInfo = mix(colorMix1, outerColor, sub(normalizedDist.mul(2.0), 1.0).clamp());

        mat.colorNode = finalColorInfo;

        // Procedural soft particle sprite
        // pointUV goes from 0 to 1 across the point sprite
        const pCenter = sub(pointUV, vec2(0.5));
        const pDist = length(pCenter);
        const alpha = sub(1.0, pDist.mul(2.0)).clamp(); // Creates a soft circle
        mat.opacityNode = alpha.pow(2.0); // Smooth falloff

        return { geometry: geo, material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    if (pointsRef.current) {
        pointsRef.current.rotation.x = Math.PI * 0.15; // tilt the galaxy
        pointsRef.current.rotation.y = t * 0.05; // slowly rotate the whole thing
    }

    return (
        <points ref={pointsRef} geometry={geometry} material={material} />
    );
}
