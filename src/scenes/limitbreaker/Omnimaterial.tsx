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
    mx_noise_float,
    mx_fractal_noise_float,
    mx_worley_noise_float,
    normalize,
    sub,
} from "three/tsl";
import { useCurrentFrame, interpolate } from "remotion";
import { useMemo } from "react";

export function Omnimaterial() {
    const frame = useCurrentFrame();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const t = timeU;
        const pos = positionLocal;

        // colorNode: 3-way noise-driven color blend
        const noiseA = mx_fractal_noise_float(pos.mul(2.0).add(vec3(t.mul(0.3), 0, 0)), 3, float(2.0), float(0.5), float(1.0));
        const noiseB = mx_worley_noise_float(pos.mul(3.0).add(vec3(0, t.mul(0.2), 0)));
        const c1 = color("#ff2266");
        const c2 = color("#2244ff");
        const c3 = color("#ffcc00");
        const mix1 = mix(c1, c2, noiseA.add(0.5).clamp());
        mat.colorNode = mix(mix1, c3, noiseB.clamp());

        mat.roughnessNode = mx_worley_noise_float(pos.mul(4.0).add(vec3(0, 0, t.mul(0.1)))).mul(0.6).add(0.1);
        mat.metalnessNode = sin(pos.y.mul(3.0).add(t.mul(1.5))).mul(0.5).add(0.5);

        const pulse = sin(t.mul(4.0)).mul(0.5).add(0.5);
        mat.emissiveNode = color("#ff4400").mul(pulse.mul(noiseA.add(0.5).clamp()).mul(0.6));

        // normalNode: procedural bump
        const bumpScale = float(0.15);
        const bumpEps = float(0.01);
        const bumpCenter = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)));
        const bumpDx = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)).add(vec3(bumpEps, 0, 0)));
        const bumpDy = mx_noise_float(pos.mul(8.0).add(vec3(t.mul(0.2), 0, 0)).add(vec3(0, bumpEps, 0)));
        const bumpGrad = vec3(bumpDx.sub(bumpCenter), bumpDy.sub(bumpCenter), bumpEps).normalize();
        mat.normalNode = normalize(normalLocal.add(bumpGrad.mul(bumpScale)));

        const vertDisp = mx_fractal_noise_float(pos.mul(1.5).add(vec3(0, t.mul(0.4), 0)), 2, float(2.0), float(0.5), float(1.0));
        mat.positionNode = positionLocal.add(normalLocal.mul(vertDisp.mul(0.06)));

        mat.clearcoatNode = sin(t.mul(1.0).add(pos.x.mul(2.0))).mul(0.5).add(0.5);
        mat.clearcoatRoughnessNode = mx_worley_noise_float(pos.mul(5.0)).mul(0.3);

        mat.iridescenceNode = float(1.0);
        mat.iridescenceIORNode = sin(t.mul(0.5)).mul(0.3).add(1.5);
        mat.iridescenceThicknessNode = noiseA.mul(200.0).add(300.0);

        mat.sheenNode = color("#8844ff").mul(sin(t.mul(0.8).add(pos.z.mul(3.0))).mul(0.5).add(0.5));
        mat.sheenRoughnessNode = float(0.4);

        mat.transmissionNode = noiseB.mul(0.4);
        mat.thicknessNode = float(0.5);
        mat.iorNode = float(1.5);

        mat.specularIntensityNode = sin(pos.y.mul(5.0).add(t)).mul(0.4).add(0.6);
        mat.specularColorNode = color("#ffffff");

        mat.anisotropyNode = sin(t.mul(0.6).add(pos.x.mul(4.0))).mul(0.5).add(0.5);
        mat.dispersionNode = float(0.3);

        return { material: mat, timeU };
    }, []);

    const t = interpolate(frame, [0, 89], [0, 10], { extrapolateRight: "clamp" });
    timeU.value = t;

    const rotY = interpolate(frame, [0, 89], [0, Math.PI * 0.8]);
    const rotX = Math.sin(t * 0.15) * 0.2;

    return (
        <>
            <mesh rotation={[rotX, rotY, 0]} material={material}>
                <torusKnotGeometry args={[1, 0.35, 256, 64]} />
            </mesh>
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 5, 5]} intensity={1.5} />
            <directionalLight position={[-3, 2, -5]} intensity={0.6} color="#4488ff" />
        </>
    );
}
