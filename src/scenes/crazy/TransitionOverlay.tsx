import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec2,
    vec4,
    uv,
    mx_worley_noise_float,
    max,
    step,
    Fn,
} from "three/tsl";
import { useMemo, useRef } from "react";

export function TransitionOverlay({ progress, timeValue }: { progress: number; timeValue: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    const { material, progU, timeU } = useMemo(() => {
        const progU = uniform(float(0));
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.transparent = true;
        mat.depthWrite = false;
        mat.depthTest = false;

        mat.colorNode = Fn(() => {
            const u = uv();

            const n = mx_worley_noise_float(u.mul(vec2(10.0, 50.0)).add(vec2(0, timeU.mul(2.0))));

            const threshold = progU.mul(1.5).sub(n.mul(0.5));

            const isWipeActive = step(u.x, threshold).sub(step(u.x, threshold.sub(0.1)));

            const wipeColor = mix(color("#ffffff"), color("#ff00ff"), n);

            const alpha = max(isWipeActive, 0.0);

            return vec4(wipeColor, alpha);
        })();

        return { material: mat, progU, timeU };
    }, []);

    progU.value = progress;
    timeU.value = timeValue;

    return (
        <mesh ref={meshRef} position={[0, 0, 4.9]}>
            <planeGeometry args={[16 * 2, 9 * 2]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
