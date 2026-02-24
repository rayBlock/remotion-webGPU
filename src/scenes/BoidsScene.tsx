import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    positionLocal,
    normalize,
    sub,
    length,
    instanceIndex,
    Fn,
    storage,
    Loop,
    If,
    uint,
    distance,
    step,
    smoothstep,
    mx_fractal_noise_vec3
} from "three/tsl";
import { WebGPUCanvas } from "../components/Canvas/WebGPUCanvas";
import { BackendDetector } from "../components/Canvas/BackendDetector";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";

extend(THREE as any);

const P_COUNT = 8192; // 8192 * 8192 = 67 million neighbor checks per frame. A real stress test for WebGPU!

function BoidsCompute() {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { positionBuffer, velocityBuffer, computeNode, localTime } = useMemo(() => {
        const basePositions = new Float32Array(P_COUNT * 4);
        const baseVelocities = new Float32Array(P_COUNT * 4);

        for (let i = 0; i < P_COUNT; i++) {
            basePositions[i * 4 + 0] = (Math.random() - 0.5) * 20;
            basePositions[i * 4 + 1] = (Math.random() - 0.5) * 20;
            basePositions[i * 4 + 2] = (Math.random() - 0.5) * 20;
            basePositions[i * 4 + 3] = 1;

            baseVelocities[i * 4 + 0] = (Math.random() - 0.5) * 0.1;
            baseVelocities[i * 4 + 1] = (Math.random() - 0.5) * 0.1;
            baseVelocities[i * 4 + 2] = (Math.random() - 0.5) * 0.1;
            baseVelocities[i * 4 + 3] = 0;
        }

        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(basePositions, 4), 'vec4', P_COUNT);
        const velStorage = storage(new THREE.StorageInstancedBufferAttribute(baseVelocities, 4), 'vec4', P_COUNT);

        const localTime = uniform(float(0));

        const computeSwarm = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const vel = velStorage.element(instanceIndex);

            const alignment = vec3(0).toVar();
            const cohesion = vec3(0).toVar();
            const separation = vec3(0).toVar();
            const neighborCount = float(0).toVar();

            const RADIUS = float(2.0);
            const MAX_SPEED = float(0.15);
            const MAX_FORCE = float(0.005);

            // O(N^2) Loop. Every particle checks every other particle.
            // This is computationally impossible for WebGL, but WebGPU chews through it.
            Loop({ type: 'uint', start: 0, end: P_COUNT }, ({ i }) => {
                const otherNode = uint(i);

                If(otherNode.notEqual(instanceIndex), () => {
                    const otherPos = posStorage.element(otherNode as any).xyz;
                    const otherVel = velStorage.element(otherNode as any).xyz;

                    const d = distance(pos.xyz, otherPos);

                    If(d.lessThan(RADIUS).and(d.greaterThan(0.001)), () => {
                        // 1. Alignment: Match velocity of neighbors
                        alignment.addAssign(otherVel);

                        // 2. Cohesion: Move towards center of mass of neighbors
                        cohesion.addAssign(otherPos);

                        // 3. Separation: Steer away to avoid crowding
                        const push = pos.xyz.sub(otherPos).normalize().div(d); // stronger push the closer they are
                        separation.addAssign(push);

                        neighborCount.addAssign(1.0);
                    });
                });
            });

            const force = vec3(0).toVar();

            If(neighborCount.greaterThan(0.0), () => {
                // Average out
                alignment.divAssign(neighborCount);
                cohesion.divAssign(neighborCount);

                // Steer Cohesion
                cohesion.subAssign(pos.xyz); // From pos to center of mass
                cohesion.assign(normalize(cohesion).mul(MAX_SPEED).sub(vel.xyz));

                // Steer Alignment
                alignment.assign(normalize(alignment).mul(MAX_SPEED).sub(vel.xyz));

                // Steer Separation (already accumulated correctly, just limit)
                separation.assign(normalize(separation).mul(MAX_SPEED).sub(vel.xyz));

                // Weighted rule application
                force.addAssign(separation.mul(1.5));
                force.addAssign(alignment.mul(1.0));
                force.addAssign(cohesion.mul(1.0));
            });

            // Confinement: Keep them inside a sphere radius 15
            const distFromCenter = length(pos.xyz);
            If(distFromCenter.greaterThan(10.0), () => {
                const steerHome = normalize(pos.xyz.negate()).mul(MAX_SPEED).sub(vel.xyz);
                force.addAssign(steerHome.mul(distFromCenter.sub(10.0).mul(0.1))); // Harder push the further out
            });

            // Noise (Wander) to keep it organic
            const wanderDir = mx_fractal_noise_vec3(pos.xyz.mul(0.5).add(vec3(0, localTime, 0)), 2, float(2.0), float(0.5), float(1.0));
            force.addAssign(wanderDir.mul(0.002));

            // Update velocity & position
            let nextVel = vel.xyz.add(force);

            // Limit speed
            const speed = length(nextVel);
            nextVel = normalize(nextVel).mul(mix(speed, MAX_SPEED, step(MAX_SPEED, speed)));

            vel.xyz = nextVel;
            pos.xyz = pos.xyz.add(nextVel);

            // Forward facing logic could be handled in geometry, but here we just pass position.
            // Boids direction is just `vel.xyz` normalized! We can extract it in the Material.
        });

        return {
            positionBuffer: posStorage,
            velocityBuffer: velStorage,
            computeNode: computeSwarm().compute(P_COUNT),
            localTime
        };
    }, []);

    localTime.value = frame / fps;

    useFrame(() => {
        (gl as any).compute(computeNode);
    });

    return { positionBuffer, velocityBuffer };
}

function BoidsRenderMesh() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { positionBuffer, velocityBuffer } = BoidsCompute();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const material = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const globalPos = positionBuffer.element(instanceIndex);
        const globalVel = velocityBuffer.element(instanceIndex);

        // Calculate a LookAt rotation matrix inside the vertex shader to point the cone in the velocity direction.
        // For simplicity, we just displace the position. In a real boid we want a matrix.
        // TSL matrix construction:
        const dir = normalize(globalVel.xyz);
        const up = vec3(0, 1, 0);
        // If dir is exactly up or down, we'd need a fallback, but practically noise prevents this.
        const right = normalize(up.cross(dir));
        const newUp = dir.cross(right); // Orthogonal up

        // Displace the local vertex position via the orientation matrix
        const rotatedPos = right.mul(positionLocal.x)
            .add(newUp.mul(positionLocal.y))
            .add(dir.mul(positionLocal.z));

        mat.positionNode = rotatedPos.add(globalPos.xyz);

        mat.colorNode = color("#000000");

        // Color based on speed
        const speed = length(globalVel.xyz);
        const fastColor = color("#00ffff");
        const slowColor = color("#ff00cc");

        // Let's add iridescence for that polished API look
        mat.emissiveNode = mix(slowColor, fastColor, speed.mul(10.0).clamp()).mul(1.5);
        mat.roughnessNode = float(0.1);
        mat.metalnessNode = float(0.9);
        mat.iridescence = 1.0;
        mat.iridescenceIOR = 1.3;

        return mat;
    }, [positionBuffer, velocityBuffer]);

    const t = frame / fps;
    if (meshRef.current) {
        meshRef.current.rotation.y = t * 0.1;
    }

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, P_COUNT]} material={material}>
            {/* A cone points naturally up (+Y). But our matrix expects +Z is forward? 
                Actually, let's use a slender cone. */}
            <coneGeometry args={[0.08, 0.3, 4]} />
        </instancedMesh>
    );
}

export const BoidsWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const [backendInfo, setBackendInfo] = useState("Detecting...");

    const handleBackend = useCallback((info: string) => {
        setBackendInfo(info);
    }, []);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <WebGPUCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 25], fov: 50 }}
                gl={async (defaultProps: any) => {
                    const canvas = defaultProps.canvas as HTMLCanvasElement;
                    const renderer = new THREE.WebGPURenderer({
                        canvas,
                        antialias: true,
                    });
                    await renderer.init();
                    return renderer as any;
                }}
            >
                <BackendDetector onDetect={handleBackend} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 20, 10]} intensity={2.0} color="#ffffff" />
                <directionalLight position={[-10, -10, -10]} intensity={0.5} color="#0044ff" />

                <BoidsRenderMesh />
            </WebGPUCanvas>

            {/* Backend overlay */}
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    fontFamily: "monospace",
                    fontSize: 16,
                    color: backendInfo.includes("WebGPU") ? "#00ff88" : "#ff4444",
                    background: "rgba(0,0,0,0.7)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: `1px solid ${backendInfo.includes("WebGPU") ? "#00ff88" : "#ff4444"}`,
                }}
            >
                Renderer: {backendInfo}
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    fontFamily: "monospace",
                    fontSize: 18,
                    color: "#fff",
                    background: "rgba(0,0,0,0.7)",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)"
                }}
            >
                O(N^2) Emergent AI Boids (67M neighbor checks/frame)
            </div>
        </AbsoluteFill>
    );
};
