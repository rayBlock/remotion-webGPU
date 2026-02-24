import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    sin,
    cos,
    vec3,
    vec2,
    positionLocal,
    normalLocal,
    mx_fractal_noise_vec3,
    normalize,
    sub,
    length,
    instanceIndex,
    texture,
    Fn,
    storage,
    step
} from "three/tsl";
import { WebGPUCanvas } from "../components/Canvas/WebGPUCanvas";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, staticFile } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { useMemo, useRef, useEffect } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";
import { BackendDetector, BackendOverlay, SceneLabel } from "../components";
import { useBackendDetection } from "../hooks";
import { createWebGPURenderer } from "../utils";

extend(THREE as any);

const NUM_SAMPLES = 64;
const P_COUNT = 50000;

function AudioSwarmCompute({ audioDataArray }: { audioDataArray: number[] }) {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // 1. Setup Audio DataTexture
    const audioTexture = useMemo(() => {
        const data = new Float32Array(NUM_SAMPLES * 4);
        const tex = new THREE.DataTexture(data, NUM_SAMPLES, 1, THREE.RGBAFormat, THREE.FloatType);
        tex.needsUpdate = true;
        return tex;
    }, []);

    // Update texture every frame with new FFT data
    useEffect(() => {
        const data = audioTexture.image.data as Float32Array;
        for (let i = 0; i < NUM_SAMPLES; i++) {
            const val = audioDataArray[i] ?? 0;
            data[i * 4] = val; // R
            data[i * 4 + 1] = val; // G
            data[i * 4 + 2] = val; // B
            data[i * 4 + 3] = 1.0; // A
        }
        audioTexture.needsUpdate = true;
    }, [audioDataArray, audioTexture]);

    // 2. Setup Compute System
    const { positionBuffer, velocityBuffer, computeNode, localTime, audioTexNode } = useMemo(() => {
        const basePositions = new Float32Array(P_COUNT * 4);
        const baseVelocities = new Float32Array(P_COUNT * 4);

        for (let i = 0; i < P_COUNT; i++) {
            // Spawn on a sphere surface roughly
            const u = Math.random() * Math.PI * 2;
            const v = Math.acos(2 * Math.random() - 1);
            const r = 3.0 + (Math.random() - 0.5) * 0.5;

            const x = r * Math.sin(v) * Math.cos(u);
            const y = r * Math.sin(v) * Math.sin(u);
            const z = r * Math.cos(v);

            basePositions[i * 4 + 0] = x;
            basePositions[i * 4 + 1] = y;
            basePositions[i * 4 + 2] = z;
            basePositions[i * 4 + 3] = 1;

            baseVelocities[i * 4 + 0] = 0;
            baseVelocities[i * 4 + 1] = 0;
            baseVelocities[i * 4 + 2] = 0;
            baseVelocities[i * 4 + 3] = 0;
        }

        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(basePositions, 4), 'vec4', P_COUNT);
        const velStorage = storage(new THREE.StorageInstancedBufferAttribute(baseVelocities, 4), 'vec4', P_COUNT);

        const localTime = uniform(float(0));
        const audioTexNode = texture(audioTexture);

        const computeSwarm = Fn(() => {
            const pos = posStorage.element(instanceIndex);
            const vel = velStorage.element(instanceIndex);

            const t = localTime;

            // Find origin distance
            const origin = vec3(0, 0, 0);
            const toOrigin = sub(origin, pos.xyz);
            const dist = length(toOrigin);
            const dir = normalize(pos.xyz); // pointing outward

            // Map particle's Y position to a frequency bucket (0.0 to 1.0)
            const audioUV = vec2(pos.y.add(3.0).div(6.0).clamp(), 0.5);

            // Sample the audio texture (R channel contains amplitude 0..1)
            const audioAmp = audioTexNode.sample(audioUV).r;

            // Base sphere gravity pulling inward to radius 3.0
            const gravityPull = dist.sub(3.0).mul(0.1);
            const gravity = dir.mul(gravityPull.negate());

            // Audio expansion pushing outward explosively based on frequency
            const expansion = dir.mul(audioAmp.mul(0.5));

            // Swarm flow field noise for organic movement
            const flowDir = mx_fractal_noise_vec3(pos.xyz.mul(2.0).add(vec3(0, t, 0)), 2, float(2.0), float(0.5), float(1.0));
            const flow = flowDir.mul(0.05);

            // Integrate forces
            let newVel = vel.xyz.mul(0.92); // Damping
            newVel = newVel.add(gravity).add(expansion).add(flow);

            vel.xyz = newVel;
            pos.xyz = pos.xyz.add(newVel);
        });

        return {
            positionBuffer: posStorage,
            velocityBuffer: velStorage,
            computeNode: computeSwarm().compute(P_COUNT),
            localTime,
            audioTexNode
        };
    }, [audioTexture]);

    // Dispatch compute shader synchronously with Remotion's frame clock
    localTime.value = frame / fps;

    useFrame(() => {
        (gl as any).compute(computeNode);
    });

    return { positionBuffer, velocityBuffer, audioTexNode };
}

function AudioSwarmMesh({ audioDataArray }: { audioDataArray: number[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const { positionBuffer, velocityBuffer, audioTexNode } = AudioSwarmCompute({ audioDataArray });

    const material = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const speed = length(velocityBuffer.element(instanceIndex).xyz);

        // Sample audio for color injection
        const pos = positionBuffer.element(instanceIndex).xyz;
        const audioUV = vec2(pos.y.add(3.0).div(6.0).clamp(), 0.5);
        const audioAmp = audioTexNode.sample(audioUV).r;

        // Base color depends on frequency band (Y position)
        const coldPhase = color("#0022ff");
        const hotPhase = color("#ff0044");
        const baseColor = mix(coldPhase, hotPhase, audioUV.x);

        // Emissive spikes based on speed and audio amplitude
        const sparkColor = color("#ffffff");
        const intensity = speed.mul(5.0).add(audioAmp.mul(2.0)).clamp();

        mat.positionNode = positionLocal.add(pos);
        mat.colorNode = color("#000000");
        mat.emissiveNode = mix(baseColor, sparkColor, intensity).mul(2.0);

        mat.roughnessNode = float(0.2);
        mat.metalnessNode = float(0.9);

        return mat;
    }, [positionBuffer, velocityBuffer, audioTexNode]);

    const t = frame / fps;
    if (meshRef.current) {
        meshRef.current.rotation.y = t * 0.2;
    }

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, P_COUNT]} material={material}>
            <sphereGeometry args={[0.03, 4, 4]} />
        </instancedMesh>
    );
}

export const AudioReactiveWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const { backendInfo, onDetect } = useBackendDetection();

    const audioSrc = staticFile("audio.mp3");
    const audioData = useAudioData(audioSrc);

    // Extract FFT buckets
    const fftBuffer = useMemo(() => {
        if (!audioData) return new Array(NUM_SAMPLES).fill(0);

        return visualizeAudio({
            fps,
            frame,
            audioData,
            numberOfSamples: NUM_SAMPLES,
        });
    }, [audioData, frame, fps]);

    return (
        <AbsoluteFill style={{ background: "#020205" }}>
            <Audio src={audioSrc} />

            <WebGPUCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 10], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <BackendDetector onDetect={onDetect} />
                <ambientLight intensity={0.2} />
                <directionalLight position={[0, 10, 5]} intensity={1.0} />

                {audioData && (
                    <AudioSwarmMesh audioDataArray={fftBuffer} />
                )}
            </WebGPUCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label="Audio-Reactive Spectrum Swarm" />

            {/* Audio Visualizer Debug */}
            <div style={{
                position: "absolute",
                bottom: 20,
                right: 20,
                display: "flex",
                gap: "2px",
                height: "60px",
                alignItems: "flex-end"
            }}>
                {fftBuffer.map((val, i) => (
                    <div key={i} style={{
                        width: "8px",
                        height: `${val * 100}%`,
                        background: `hsl(${i * (360 / NUM_SAMPLES)}, 100%, 50%)`,
                        borderRadius: "2px 2px 0 0"
                    }} />
                ))}
            </div>
        </AbsoluteFill>
    );
};
