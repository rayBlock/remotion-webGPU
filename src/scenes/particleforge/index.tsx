import "../../utils/extendThree";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { WebGPUSync } from "../../WebGPUSync";
import type { ParticleForgeProps } from "../../schemas";
import { BackendDetector, BackendOverlay, SceneLabel } from "../../components";
import { useBackendDetection } from "../../hooks";
import { createWebGPURenderer } from "../../utils";
import { SpiralGalaxy } from "./SpiralGalaxy";
import { MorphingShapes } from "./MorphingShapes";
import { FlowField } from "./FlowField";
import { Supernova } from "./Supernova";
import { AuroraVeil } from "./AuroraVeil";

const SCENE_LABELS = [
    "1/5: Spiral Galaxy \u2014 200K Keplerian Orbits",
    "2/5: Morphing Shapes \u2014 100K Shape Transitions",
    "3/5: Flow Field \u2014 150K Curl-Noise Advection",
    "4/5: Supernova \u2014 200K Explosion \u2192 Implosion",
    "5/5: Aurora Veil \u2014 300K Borealis Sheets",
];

export const ParticleForge: React.FC<ParticleForgeProps> = (props) => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const { backendInfo, onDetect } = useBackendDetection();

    const sceneIndex = Math.min(Math.floor(frame / 90), 4);

    return (
        <AbsoluteFill style={{ background: "#030308" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 2, 8], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <BackendDetector onDetect={onDetect} />
                <Sequence from={0} durationInFrames={90} layout="none">
                    <SpiralGalaxy props={props} />
                </Sequence>
                <Sequence from={90} durationInFrames={90} layout="none">
                    <MorphingShapes props={props} />
                </Sequence>
                <Sequence from={180} durationInFrames={90} layout="none">
                    <FlowField props={props} />
                </Sequence>
                <Sequence from={270} durationInFrames={90} layout="none">
                    <Supernova props={props} />
                </Sequence>
                <Sequence from={360} durationInFrames={90} layout="none">
                    <AuroraVeil props={props} />
                </Sequence>
            </ThreeCanvas>

            <BackendOverlay info={backendInfo} />
            <SceneLabel label={SCENE_LABELS[sceneIndex]} />

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    fontFamily: "monospace",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.5)",
                    background: "rgba(0,0,0,0.5)",
                    padding: "6px 12px",
                    borderRadius: 6,
                }}
            >
                GPU COMPUTE // FRAME {frame}
            </div>
        </AbsoluteFill>
    );
};
