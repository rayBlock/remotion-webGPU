import "../../utils/extendThree";
import * as THREE from "three/webgpu";
import { uniform, float } from "three/tsl";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from "remotion";
import { WebGPUSync } from "../../WebGPUSync";
import type { CrazyWebGPUSceneProps } from "../../schemas";
import { createWebGPURenderer } from "../../utils";
import { CyberSwarm } from "./CyberSwarm";
import { RaymarchingBackdrop } from "./RaymarchingBackdrop";
import { TransitionOverlay } from "./TransitionOverlay";

function useComputePhaseParams(props: CrazyWebGPUSceneProps) {
    const frame = useCurrentFrame();

    const phase = uniform(float(0));
    if (frame < 100) phase.value = 0;
    else if (frame < 200) phase.value = 1;
    else phase.value = 2;

    return { phase };
}

function SceneWithPhasesAndTransitions({ props }: { props: CrazyWebGPUSceneProps }) {
    const { phase } = useComputePhaseParams(props);
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = frame / fps;

    const tr1 = interpolate(frame, [90, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const tr2 = interpolate(frame, [190, 210], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    let activeTrProgress = 0;
    if (frame > 80 && frame < 120) activeTrProgress = tr1;
    if (frame > 180 && frame < 220) activeTrProgress = tr2;

    return (
        <>
            <ambientLight intensity={0.2} />
            <directionalLight position={[0, 10, 10]} intensity={2.0} color="#00ffcc" />
            <pointLight position={[0, 0, 0]} intensity={5.0} color="#ff00ff" distance={10} />

            <RaymarchingBackdrop props={props} phaseNode={phase} />
            <CyberSwarm props={props} phaseNode={phase} />

            {activeTrProgress > 0 && activeTrProgress < 1 && (
                <TransitionOverlay progress={activeTrProgress} timeValue={t} />
            )}
        </>
    );
}

export const CrazyScene: React.FC<CrazyWebGPUSceneProps> = (props) => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();

    let phaseStr = "P1: FLOCKING / FRACTAL TUNNEL";
    if (frame >= 100 && frame < 200) phaseStr = "P2: ORBITAL / MEGASPHERE";
    if (frame >= 200) phaseStr = "P3: LATTICE / INFINITE GRID";

    if (frame > 90 && frame < 110) phaseStr = "TRANSITION OVERRIDE...";
    if (frame > 190 && frame < 210) phaseStr = "TRANSITION OVERRIDE...";

    return (
        <AbsoluteFill style={{ background: "#000" }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 5], fov: 60 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <SceneWithPhasesAndTransitions props={props} />
            </ThreeCanvas>

            <div
                style={{
                    position: "absolute",
                    top: 40,
                    left: 40,
                    fontFamily: "monospace",
                    fontSize: 24,
                    color: "#00ffcc",
                    textShadow: "0 0 10px #00ffcc"
                }}
            >
                SYS.CORE.COMPUTE_OVERRIDE_ENABLED
            </div>
            <div
                style={{
                    position: "absolute",
                    bottom: 40,
                    left: 40,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "sans-serif",
                    fontSize: 16
                }}
            >
                FRAME {frame} // BOIDS: {props.particleCount} // {phaseStr}
            </div>
        </AbsoluteFill>
    );
};
