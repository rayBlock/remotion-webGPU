import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    vec2,
    vec3,
    vec4,
    uv,
    normalize,
    abs,
    max,
    min,
    step,
    fract,
    length,
    mx_fractal_noise_float,
    Fn,
    If,
    select,
} from "three/tsl";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo, useRef } from "react";
import type { CrazyWebGPUSceneProps } from "../../schemas";

export function RaymarchingBackdrop({ props, phaseNode }: { props: CrazyWebGPUSceneProps, phaseNode: any }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { material, localTime } = useMemo(() => {
        const localTime = uniform(float(0));
        const mat = new THREE.MeshBasicNodeMaterial();
        mat.side = THREE.BackSide;
        mat.depthWrite = false;

        const rmFn = Fn(() => {
            const pcoord = uv().mul(2.0).sub(1.0);
            pcoord.x = pcoord.x.mul(1920.0 / 1080.0);

            const t = localTime.mul(0.2);
            const ro = vec3(0.0, 0.0, -3.0);
            const rd = normalize(vec3(pcoord, 1.0));

            const dO = float(0.0).toVar();
            const phase = phaseNode;

            const volDensity = float(0.0).toVar();

            for (let i = 0; i < 32; i++) {
                const p = ro.add(rd.mul(dO));

                If(phase.equal(0), () => {
                    let q = p.add(vec3(0, 0, t.mul(5.0)));
                    q = fract(q.mul(0.5)).sub(0.5).mul(2.0);
                    const d = length(q).sub(0.5);
                    const isInside = step(d, 0.0);
                    volDensity.addAssign(isInside.mul(0.03));
                });

                If(phase.equal(1), () => {
                    const singularityPos = vec3(0, 0, 5.0);
                    const toSingularity = p.sub(singularityPos);
                    const distToSingularity = length(toSingularity);

                    const eventHorizon = distToSingularity.sub(1.5);

                    const lensStrength = float(0.5).div(distToSingularity.add(0.1).pow(2.0));
                    const bendDir = normalize(toSingularity.negate());

                    rd.assign(normalize(rd.add(bendDir.mul(lensStrength))));

                    const diskDist = length(vec2(toSingularity.x, toSingularity.z)).sub(1.8);
                    const diskThickness = abs(toSingularity.y).sub(0.2);

                    const isDisk = step(diskDist, 3.0).mul(step(diskThickness, 0.0)).mul(step(0.0, eventHorizon));

                    const diskNoise = mx_fractal_noise_float(p.mul(3.0).add(vec3(t.mul(5.0), 0, t.mul(5.0))), 3, float(2.0), float(0.5), float(1.0));

                    volDensity.addAssign(isDisk.mul(diskNoise.add(0.5).mul(0.08)));

                    const isInsideHorizon = step(eventHorizon, 0.0);
                    volDensity.addAssign(isInsideHorizon.mul(1.0));
                });

                If(phase.equal(2), () => {
                    let q = fract(p.mul(2.0)).sub(0.5);
                    const qabs = abs(q);
                    const boxDist = length(max(qabs.sub(vec3(0.05)), 0.0)).add(min(max(qabs.x, max(qabs.y, qabs.z)), 0.0));
                    const isInside = step(boxDist, 0.0);
                    volDensity.addAssign(isInside.mul(0.05));
                });

                dO.addAssign(0.15);
            }

            const core1 = color(props.p1CoreColor);
            const edge1 = color(props.p1EdgeColor);
            const core2 = color(props.p2CoreColor);
            const edge2 = color(props.p2EdgeColor);
            const core3 = color(props.p3CoreColor);
            const edge3 = color(props.p3EdgeColor);

            const cCore = select(phase.equal(0), core1, select(phase.equal(1), core2, core3));
            const cEdge = select(phase.equal(0), edge1, select(phase.equal(1), edge2, edge3));

            const finalCol = mix(vec3(0.0), mix(cCore, cEdge, sin(dO.mul(0.2)).mul(0.5).add(0.5)), volDensity);
            return vec4(finalCol, 1.0);
        });

        mat.colorNode = rmFn();
        return { material: mat, localTime };
    }, [props]);

    localTime.value = frame / fps;

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[40, 40, 40]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
