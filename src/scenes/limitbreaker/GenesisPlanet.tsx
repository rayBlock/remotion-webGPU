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
    normalWorld,
    cameraPosition,
    positionWorld,
    mx_fractal_noise_float,
    normalize,
    dot,
    pow,
    abs,
    sub,
    smoothstep,
} from "three/tsl";
import { useCurrentFrame, interpolate } from "remotion";
import { useMemo } from "react";

export function GenesisPlanet() {
    const frame = useCurrentFrame();

    const { planetMat, cloudMat, atmosMat, timeU } = useMemo(() => {
        const timeU = uniform(float(0));

        // PLANET SURFACE
        const planetMat = new THREE.MeshPhysicalNodeMaterial();
        const pos = positionLocal;

        const terrainInput = pos.mul(2.0).add(vec3(0.42, 1.37, 0.89));
        const terrain = mx_fractal_noise_float(terrainInput, 6, float(2.0), float(0.5), float(1.0));

        planetMat.positionNode = positionLocal.add(normalLocal.mul(terrain.mul(0.25)));

        const h = terrain.add(0.5);
        const deepOcean = color("#001144");
        const shallowWater = color("#006688");
        const beach = color("#ccbb77");
        const grass = color("#228833");
        const rock = color("#665544");
        const snow = color("#eeeeff");

        const t1 = smoothstep(0.3, 0.35, h);
        const t2 = smoothstep(0.4, 0.45, h);
        const t3 = smoothstep(0.5, 0.55, h);
        const t4 = smoothstep(0.65, 0.7, h);
        const t5 = smoothstep(0.8, 0.85, h);

        const col1 = mix(deepOcean, shallowWater, t1);
        const col2 = mix(col1, beach, t2);
        const col3 = mix(col2, grass, t3);
        const col4 = mix(col3, rock, t4);
        planetMat.colorNode = mix(col4, snow, t5);

        planetMat.roughnessNode = mix(float(0.1), float(0.7), t2);
        planetMat.metalnessNode = mix(float(0.3), float(0.0), t2);

        // CLOUD LAYER
        const cloudMat = new THREE.MeshPhysicalNodeMaterial();
        cloudMat.transparent = true;
        cloudMat.side = THREE.DoubleSide;
        cloudMat.depthWrite = false;

        const cloudInput = positionLocal.mul(3.0).add(vec3(timeU.mul(0.05), timeU.mul(0.02), timeU.mul(0.03)));
        const cloudNoise = mx_fractal_noise_float(cloudInput, 4, float(2.0), float(0.5), float(1.0));
        const cloudDensity = smoothstep(0.0, 0.3, cloudNoise);

        cloudMat.colorNode = color("#ffffff");
        cloudMat.opacityNode = cloudDensity.mul(0.7);
        cloudMat.emissiveNode = color("#222222").mul(cloudDensity);

        // ATMOSPHERE
        const atmosMat = new THREE.MeshPhysicalNodeMaterial();
        atmosMat.transparent = true;
        atmosMat.side = THREE.BackSide;
        atmosMat.depthWrite = false;

        const viewDir = normalize(sub(cameraPosition, positionWorld));
        const rim = float(1.0).sub(abs(dot(normalWorld, viewDir)));
        const atmosGlow = pow(rim, 3.0);

        atmosMat.colorNode = color("#000000");
        atmosMat.emissiveNode = mix(color("#4488ff"), color("#aaddff"), atmosGlow).mul(atmosGlow.mul(2.0));
        atmosMat.opacityNode = atmosGlow.mul(0.8);

        const atmosPulse = sin(timeU.mul(2.0)).mul(0.1).add(1.0);
        atmosMat.emissiveNode = (atmosMat.emissiveNode as any).mul(atmosPulse);

        return { planetMat, cloudMat, atmosMat, timeU };
    }, []);

    const t = interpolate(frame, [0, 89], [0, 8], { extrapolateRight: "clamp" });
    timeU.value = t;

    const planetRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.5]);
    const cloudsRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.65]);
    const atmosRotY = interpolate(frame, [0, 89], [0, Math.PI * 0.2]);

    return (
        <>
            <mesh rotation={[0, planetRotY, 0]} material={planetMat}>
                <sphereGeometry args={[1.5, 128, 128]} />
            </mesh>
            <mesh rotation={[0.1, cloudsRotY, 0]} material={cloudMat}>
                <sphereGeometry args={[1.55, 96, 96]} />
            </mesh>
            <mesh rotation={[0, atmosRotY, 0]} material={atmosMat}>
                <sphereGeometry args={[1.75, 64, 64]} />
            </mesh>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 3, 4]} intensity={1.8} />
        </>
    );
}
