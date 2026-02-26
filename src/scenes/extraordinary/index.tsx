import "../../utils/extendThree";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { WebGPUSync } from "../../WebGPUSync";
import { BackendDetector, BackendOverlay, SceneLabel } from "../../components";
import { useBackendDetection } from "../../hooks";
import { createWebGPURenderer } from "../../utils";
import { LiquidPlasmaBlob } from "./LiquidPlasmaBlob";
import { NeonTerrain } from "./NeonTerrain";
import { FlowFieldSwarm } from "./FlowFieldSwarm";
import { PointCloudNebula } from "./PointCloudNebula";
import { MandelbulbRaymarcher } from "./MandelbulbRaymarcher";
import { QuantumMorphingSwarm } from "./QuantumMorphingSwarm";

function SceneSetup({ children, onBackend }: { children: React.ReactNode; onBackend: (info: string) => void }) {
    return (
        <>
            <BackendDetector onDetect={onBackend} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#4488ff" />
            {children}
        </>
    );
}

const SCENE_LABELS = [
    "1/6: Liquid Iridescent Plasma Blob",
    "2/6: Synthwave Neon Grid Terrain",
    "3/6: Flow-Field GPU Particle Swarm",
    "4/6: Galactic Point Cloud Nebula",
    "5/6: Mandelbulb Raymarcher",
    "6/6: Quantum Geometry Morphing",
];

export const ExtraordinaryWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 50), 5);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 7], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <SceneSetup onBackend={onDetect}>
                    <Sequence from={0} durationInFrames={50} layout="none">
                        <LiquidPlasmaBlob />
                    </Sequence>
                    <Sequence from={50} durationInFrames={50} layout="none">
                        <NeonTerrain />
                    </Sequence>
                    <Sequence from={100} durationInFrames={50} layout="none">
                        <FlowFieldSwarm />
                    </Sequence>
                    <Sequence from={150} durationInFrames={50} layout="none">
                        <PointCloudNebula />
                    </Sequence>
                    <Sequence from={200} durationInFrames={50} layout="none">
                        <MandelbulbRaymarcher />
                    </Sequence>
                    <Sequence from={250} durationInFrames={50} layout="none">
                        <QuantumMorphingSwarm />
                    </Sequence>
                </SceneSetup>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />
        </AbsoluteFill>
    );
};
