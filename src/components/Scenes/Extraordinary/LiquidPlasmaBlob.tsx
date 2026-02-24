import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    vec3,
    positionLocal,
    normalLocal,
    mx_fractal_noise_float,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";

export function LiquidPlasmaBlob() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.Mesh>(null);

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        // Complex flowing 3D noise for vertex displacement
        const basePos = positionLocal.mul(1.5);
        const timeOffset = vec3(timeU.mul(0.3), timeU.mul(0.2), timeU.mul(0.5));
        const noiseInput = basePos.add(timeOffset);

        const displacement = mx_fractal_noise_float(noiseInput, 4, float(2.0), float(0.5), float(1.0));
        const pushDist = displacement.mul(0.6);

        // Displace position
        mat.positionNode = positionLocal.add(normalLocal.mul(pushDist));

        // Colors base on displacement + iridescence
        const purple = color("#9d00ff");
        const pink = color("#ff007f");
        const cyan = color("#00f0ff");

        // Mix colors via multiple noises
        const colorMix1 = mix(purple, pink, displacement.add(0.5).clamp());
        const colorMix2 = mix(colorMix1, cyan, sin(timeU.add(positionLocal.y.mul(2.0))).mul(0.5).add(0.5));

        mat.colorNode = colorMix2;
        mat.roughnessNode = float(0.0); // very smooth
        mat.metalnessNode = float(0.1);
        mat.transmission = 1.0; // Glass-like
        mat.thickness = 2.0;
        mat.ior = 1.6;

        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;
        mat.iridescenceThicknessNode = displacement.mul(200.0).add(300.0);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    if (meshRef.current) {
        meshRef.current.rotation.x = t * 0.1;
        meshRef.current.rotation.y = t * 0.2;
    }

    return (
        <mesh ref={meshRef} material={material}>
            <sphereGeometry args={[1.5, 128, 128]} />
        </mesh>
    );
}
