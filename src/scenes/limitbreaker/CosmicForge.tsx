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
    normalize,
    dot,
    pow,
    sub,
    add,
    max,
    min,
    clamp,
    length,
    step,
    uv,
    Fn,
    Loop,
    Break,
    If,
    hash,
    abs,
} from "three/tsl";
import { useCurrentFrame, interpolate } from "remotion";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";

export function CosmicForge() {
    const frame = useCurrentFrame();
    const { viewport } = useThree();

    const { material, timeU } = useMemo(() => {
        const timeU = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.DoubleSide;

        mat.colorNode = Fn(() => {
            const suv = uv();
            const aspect = float(1920.0 / 1080.0);
            const rd_xy = vec2(
                suv.x.sub(0.5).mul(2.0).mul(aspect),
                suv.y.sub(0.5).mul(2.0)
            );

            const ro = vec3(
                sin(timeU.mul(0.3)).mul(4.0),
                cos(timeU.mul(0.2)).mul(2.0),
                cos(timeU.mul(0.3)).mul(4.0)
            );
            const target = vec3(0, 0, 0);
            const forward = normalize(sub(target, ro));
            const right = normalize(vec3(forward.z, float(0), forward.x.negate()));
            const up = normalize(vec3(
                right.y.mul(forward.z).sub(right.z.mul(forward.y)),
                right.z.mul(forward.x).sub(right.x.mul(forward.z)),
                right.x.mul(forward.y).sub(right.y.mul(forward.x))
            ));
            const rd = normalize(
                right.mul(rd_xy.x).add(up.mul(rd_xy.y)).add(forward.mul(1.5))
            );

            const sdSphere = Fn(([p_immutable, r]: [any, any]) => {
                const p = vec3(p_immutable).toVar();
                return length(p).sub(r);
            });

            const sdTorus = Fn(([p_immutable, t1, t2]: [any, any, any]) => {
                const p = vec3(p_immutable).toVar();
                const q = vec2(length(vec2(p.x, p.z)).sub(t1), p.y);
                return length(q).sub(t2);
            });

            const sdBox = Fn(([p_immutable, b_immutable]: [any, any]) => {
                const p = vec3(p_immutable).toVar();
                const b = vec3(b_immutable).toVar();
                const q = abs(p).sub(b);
                return length(max(q, 0.0)).add(min(max(q.x, max(q.y, q.z)), 0.0));
            });

            const smin = Fn(([a, b, k]: [any, any, any]) => {
                const h = clamp(float(0.5).add(float(0.5).mul(b.sub(a)).div(k)), 0.0, 1.0);
                return mix(b, a, h).sub(k.mul(h).mul(float(1.0).sub(h)));
            });

            const sceneSDF = Fn(([p_immutable]: [any]) => {
                const p = vec3(p_immutable).toVar();
                const t = timeU;

                const spherePos = vec3(sin(t.mul(0.7)).mul(1.2), cos(t.mul(0.5)).mul(0.5), cos(t.mul(0.8)).mul(1.0));
                const d1 = sdSphere(p.sub(spherePos), float(0.8).add(sin(t.mul(2.0)).mul(0.15)));

                const torusPos = vec3(cos(t.mul(0.6)).mul(1.5), sin(t.mul(0.9)).mul(0.3), sin(t.mul(0.6)).mul(1.5));
                const d2 = sdTorus(p.sub(torusPos), float(0.6), float(0.2));

                const boxPos = vec3(cos(t.mul(0.4)).mul(-1.0), sin(t.mul(0.3)).mul(0.8), sin(t.mul(0.5)).mul(-0.5));
                const d3 = sdBox(p.sub(boxPos), vec3(0.5, 0.5, 0.5)).sub(0.08);

                const d12 = smin(d1, d2, float(0.5));
                return smin(d12, d3, float(0.4));
            });

            const totalDist = float(0).toVar();
            const marchPos = vec3(ro).toVar();
            const hitDist = float(100.0).toVar();

            Loop(80, () => {
                const d = sceneSDF(marchPos);
                hitDist.assign(d);
                totalDist.addAssign(d);
                marchPos.addAssign(rd.mul(d));
                If(d.lessThan(0.001), () => {
                    Break();
                });
                If(totalDist.greaterThan(20.0), () => {
                    Break();
                });
            });

            const eps = float(0.001);
            const calcNormal = Fn(([p_immutable]: [any]) => {
                const p = vec3(p_immutable).toVar();
                return normalize(vec3(
                    sceneSDF(p.add(vec3(eps, 0, 0))).sub(sceneSDF(p.sub(vec3(eps, 0, 0)))),
                    sceneSDF(p.add(vec3(0, eps, 0))).sub(sceneSDF(p.sub(vec3(0, eps, 0)))),
                    sceneSDF(p.add(vec3(0, 0, eps))).sub(sceneSDF(p.sub(vec3(0, 0, eps))))
                ));
            });

            const n = calcNormal(marchPos);
            const lightDir = normalize(vec3(
                sin(timeU.mul(0.5)).mul(3.0),
                float(4.0),
                cos(timeU.mul(0.5)).mul(3.0)
            ));
            const diff = max(dot(n, lightDir), 0.0);
            const viewDir = normalize(sub(ro, marchPos));
            const halfDir = normalize(add(lightDir, viewDir));
            const spec = pow(max(dot(n, halfDir), 0.0), 64.0);
            const fresnel = pow(float(1.0).sub(max(dot(n, viewDir), 0.0)), 3.0);

            const aoSample = sceneSDF(marchPos.add(n.mul(0.1)));
            const ao = clamp(aoSample.mul(10.0), 0.0, 1.0);

            const baseCol = mix(
                color("#1a0533"),
                color("#ff4466"),
                fresnel
            );
            const lit = baseCol.mul(diff.mul(0.7).add(0.15)).add(
                color("#aaccff").mul(spec.mul(1.5))
            ).add(color("#ff6600").mul(fresnel.mul(0.4)));
            const withAO = lit.mul(ao.mul(0.7).add(0.3));

            const fog = float(1.0).sub(clamp(totalDist.mul(0.08), 0.0, 1.0));

            const bgColor = mix(color("#020010"), color("#0a0030"), rd.y.mul(0.5).add(0.5));
            const starNoise = hash(float(rd.x.mul(1000.0).add(rd.y.mul(5000.0))));
            const stars = step(0.998, starNoise).mul(0.8);
            const bg = bgColor.add(stars);

            const hit = step(hitDist, float(0.01));
            const finalColor = mix(bg, withAO, hit.mul(fog));

            const glow = float(0.02).div(hitDist.add(0.02)).mul(float(1.0).sub(hit));
            return finalColor.add(color("#ff3300").mul(glow.mul(0.3)));
        })();

        return { material: mat, timeU };
    }, []);

    const t = interpolate(frame, [0, 89], [0, 6], { extrapolateRight: "clamp" });
    timeU.value = t;

    return (
        <mesh material={material}>
            <planeGeometry args={[viewport.width, viewport.height]} key="fullscreen-plane" />
        </mesh>
    );
}
