import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uv,
    uniform,
    float,
    vec2,
    vec3,
    positionLocal,
    normalLocal,
    mx_fractal_noise_float,
    pow,
    smoothstep,
    fract
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";

export function NeonTerrain() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.Mesh>(null);

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshStandardNodeMaterial();
        mat.wireframe = false;

        // Displace vertices to form mountains that scroll towards camera
        const uvCoord = uv();
        const scrollSpeed = timeU.mul(0.5);
        const terrainPos = vec2(uvCoord.x.mul(10.0), uvCoord.y.mul(10.0).add(scrollSpeed));

        // Use layered noise for mountains
        const elevation = mx_fractal_noise_float(vec3(terrainPos.x, terrainPos.y, 0.0), 3, float(2.0), float(0.5), float(1.0));
        // Flatten valleys
        const height = pow(elevation.add(0.5).clamp(), 2.0).mul(2.0);

        mat.positionNode = positionLocal.add(normalLocal.mul(height));

        // Fragment Shader: Grid
        const gridScale = float(20.0);
        const gridUV = uvCoord.mul(gridScale);
        gridUV.y = gridUV.y.add(scrollSpeed.mul(gridScale.div(10.0))); // sync grid with terrain

        const gridX = fract(gridUV.x);
        const gridY = fract(gridUV.y);
        const lineX = smoothstep(0.0, 0.05, gridX).mul(smoothstep(1.0, 0.95, gridX));
        const lineY = smoothstep(0.0, 0.05, gridY).mul(smoothstep(1.0, 0.95, gridY));
        const gridLine = float(1.0).sub(lineX.mul(lineY));

        // Glow colors based on height
        const baseColor = color("#050015");
        const gridColor1 = color("#ff00ff"); // Magenta
        const gridColor2 = color("#00ffff"); // Cyan

        const heightColorMix = mix(gridColor1, gridColor2, elevation.add(0.5).clamp());

        mat.colorNode = baseColor;
        mat.emissiveNode = heightColorMix.mul(gridLine).mul(2.0); // Glow
        mat.roughnessNode = float(0.8);
        mat.metalnessNode = float(0.2);

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    if (meshRef.current) {
        // Pitch it down to look like terrain
        meshRef.current.rotation.x = -Math.PI / 2 + 0.2;
        meshRef.current.position.y = -1.0;
    }

    return (
        <mesh ref={meshRef} material={material}>
            <planeGeometry args={[20, 20, 128, 128]} />
        </mesh>
    );
}
