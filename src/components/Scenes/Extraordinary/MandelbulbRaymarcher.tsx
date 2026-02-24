import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uv,
    uniform,
    float,
    sin,
    cos,
    vec3,
    pow,
    sub,
    length,
    normalize,
    If,
    Fn,
    Break,
    log,
    atan,
    acos,
    min,
    vec4,
    step,
    fract,
    remap
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";

export function MandelbulbRaymarcher() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const meshRef = useRef<THREE.Mesh>(null);

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.BackSide;
        mat.depthWrite = false;

        mat.colorNode = Fn(() => {
            const pcoord = uv().mul(2.0).sub(1.0);
            pcoord.x = pcoord.x.mul(1920.0 / 1080.0);

            const ro = vec3(0.0, 0.0, -2.5);
            const rd = normalize(vec3(pcoord, 1.0));

            const dO = float(0.0).toVar();
            const power = sin(timeU).mul(2.0).add(6.0); // Animate power 4 to 8

            const marchSteps = 60;
            const trap = vec4(1000.0).toVar();

            for (let i = 0; i < marchSteps; i++) {
                const p = ro.add(rd.mul(dO));

                // Rotation
                const t = timeU.mul(0.2);
                const rotP = vec3(
                    p.x.mul(cos(t)).sub(p.z.mul(sin(t))),
                    p.y,
                    p.x.mul(sin(t)).add(p.z.mul(cos(t)))
                );

                // Mandelbulb SDF Z^n + C
                const z = rotP.toVar();
                const dr = float(1.0).toVar();
                const r = float(0.0).toVar();

                let escaped = false;
                for (let j = 0; j < 8; j++) {
                    r.assign(length(z));
                    If(r.greaterThan(2.0), () => Break());

                    const theta = acos(z.y.div(r));
                    const phi = atan(z.x, z.z);

                    dr.assign(pow(r, power.sub(1.0)).mul(power).mul(dr).add(1.0));

                    const zr = pow(r, power);
                    const newTheta = theta.mul(power);
                    const newPhi = phi.mul(power);

                    z.assign(vec3(
                        sin(newTheta).mul(cos(newPhi)),
                        cos(newTheta),
                        sin(newTheta).mul(sin(newPhi))
                    ).mul(zr).add(rotP));

                    trap.assign(min(trap, vec4(z.x, z.y, z.z, r)));
                }

                const d = r.mul(log(r)).mul(0.5).div(dr);
                dO.addAssign(d);
            }

            // Coloring based on orbit trap and distance
            const hitMask = step(dO, 10.0); // Did we hit the fractal before max distance?
            const bg = color("#000000");

            // Neon fractal glowing based on trap
            const trapColor = mix(
                color("#ff0033"),
                color("#00ffff"),
                fract(trap.x.add(trap.y).add(trap.z))
            );

            const intensity = remap(dO, 1.0, 3.0, 1.0, 0.0).clamp();
            const finalColor = trapColor.mul(intensity).mul(1.5).add(0.1);

            return vec4(mix(bg, finalColor, hitMask), 1.0);
        })();

        return { material: mat, timeU };
    }, []);

    const t = frame / fps;
    timeU.value = t;

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[40, 40, 40]} />
            <meshBasicMaterial color="#000" />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
