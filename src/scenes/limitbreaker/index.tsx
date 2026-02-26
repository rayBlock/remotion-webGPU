import "../../utils/extendThree";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { WebGPUSync } from "../../WebGPUSync";
import { BackendDetector, BackendOverlay, SceneLabel } from "../../components";
import { useBackendDetection } from "../../hooks";
import { createWebGPURenderer } from "../../utils";
import { CosmicForge } from "./CosmicForge";
import { Omnimaterial } from "./Omnimaterial";
import { GenesisPlanet } from "./GenesisPlanet";
import { Entropy } from "./Entropy";
import { Nexus } from "./Nexus";

const SCENE_LABELS = [
    "1/5: Cosmic Forge \u2014 SDF Ray Marching",
    "2/5: Omnimaterial \u2014 Every Physical Property",
    "3/5: Genesis \u2014 Procedural Planet",
    "4/5: Entropy \u2014 Dissolving Mesh + Discard()",
    "5/5: Nexus \u2014 50K Instance Swarm",
];

export const LimitBreaker: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 90), 4);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 5], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <BackendDetector onDetect={onDetect} />
                <Sequence from={0} durationInFrames={90} layout="none">
                    <CosmicForge />
                </Sequence>
                <Sequence from={90} durationInFrames={90} layout="none">
                    <Omnimaterial />
                </Sequence>
                <Sequence from={180} durationInFrames={90} layout="none">
                    <GenesisPlanet />
                </Sequence>
                <Sequence from={270} durationInFrames={90} layout="none">
                    <Entropy />
                </Sequence>
                <Sequence from={360} durationInFrames={90} layout="none">
                    <Nexus />
                </Sequence>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />
        </AbsoluteFill>
    );
};
