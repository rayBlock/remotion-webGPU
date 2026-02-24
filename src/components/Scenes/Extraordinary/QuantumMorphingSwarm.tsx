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
    pow,
    step,
    smoothstep,
    fract,
    instanceIndex,
    If
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";

export function QuantumMorphingSwarm() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const COUNT = 100000;

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const id = float(instanceIndex);
        const t = timeU;

        // 1: Sphere (Fibonacci lattice)
        const phiS = id.mul(Math.PI * (3.0 - Math.sqrt(5.0)));
        const yS = float(1.0).sub(id.div(100000.0).mul(2.0));
        const radiusS = pow(float(1.0).sub(yS.mul(yS)), 0.5);
        const spherePos = vec3(cos(phiS).mul(radiusS), yS, sin(phiS).mul(radiusS)).mul(2.5);

        // 2: Torus
        const uT = fract(id.div(316.0)).mul(Math.PI * 2.0);
        const vT = id.div(100000.0).mul(Math.PI * 2.0);
        const rT = float(2.0);
        const cT = float(0.8);
        const torusPos = vec3(
            rT.add(cT.mul(cos(vT))).mul(cos(uT)),
            cT.mul(sin(vT)),
            rT.add(cT.mul(cos(vT))).mul(sin(uT))
        );

        // 3: Moebius Strip
        const uM = fract(id.div(316.0)).mul(Math.PI * 2.0);
        const vM = id.div(100000.0).mul(2.0).sub(1.0);
        const moebiusRadius = float(1.0).add(vM.mul(0.5).mul(cos(uM.mul(0.5))));
        const moebiusPos = vec3(
            cos(uM).mul(moebiusRadius),
            sin(uM).mul(moebiusRadius),
            vM.mul(0.5).mul(sin(uM.mul(0.5)))
        ).mul(2.0);

        // Animation logic 
        // 3 stages, each taking 1/3 of the loop
        const animDist = t.mul(0.5).mod(3.0);
        const isStage1 = step(animDist, 1.0);
        const isStage2 = step(1.0, animDist).mul(step(animDist, 2.0));
        const isStage3 = step(2.0, animDist);

        const localT = fract(animDist);
        // Add a smooth breathing effect to the transition
        const smoothT = smoothstep(0.0, 1.0, smoothstep(0.0, 1.0, localT));

        const pos = vec3(0).toVar();
        If(isStage1.greaterThan(0), () => pos.assign(mix(spherePos, torusPos, smoothT)));
        If(isStage2.greaterThan(0), () => pos.assign(mix(torusPos, moebiusPos, smoothT)));
        If(isStage3.greaterThan(0), () => pos.assign(mix(moebiusPos, spherePos, smoothT)));

        // Add some localized organic noise breathing
        const organicNoise = mx_fractal_noise_vec3(pos.mul(2.0).add(t), 2, float(2.0), float(0.5), float(1.0));

        mat.positionNode = positionLocal.add(pos).add(organicNoise.mul(0.1));

        // Colors based on current morph state
        const color1 = color("#00ff88");
        const color2 = color("#ff007f");
        const color3 = color("#00aaff");

        const mixedColor = vec3(0).toVar();
        If(isStage1.greaterThan(0), () => mixedColor.assign(mix(color1, color2, smoothT)));
        If(isStage2.greaterThan(0), () => mixedColor.assign(mix(color2, color3, smoothT)));
        If(isStage3.greaterThan(0), () => mixedColor.assign(mix(color3, color1, smoothT)));

        mat.colorNode = color("#000000");
        mat.emissiveNode = mixedColor.mul(1.5);
        mat.roughnessNode = float(0.1);
        mat.metalnessNode = float(0.9);
        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    if (meshRef.current) {
        meshRef.current.rotation.x = t * 0.2;
        meshRef.current.rotation.y = t * 0.3;
        meshRef.current.rotation.z = t * 0.1;
    }

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} material={material}>
            <sphereGeometry args={[0.015, 4, 4]} />
        </instancedMesh>
    );
}
