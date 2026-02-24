import * as THREE from "three/webgpu";
import { WebGPUCanvas } from "../../Canvas/WebGPUCanvas";
import { BackendDetector } from "../../Canvas/BackendDetector";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from "remotion";
import { useState, useCallback } from "react";
import { LiquidPlasmaBlob } from "./LiquidPlasmaBlob";
import { NeonTerrain } from "./NeonTerrain";
import { FlowFieldSwarm } from "./FlowFieldSwarm";
import { PointCloudNebula } from "./PointCloudNebula";
import { MandelbulbRaymarcher } from "./MandelbulbRaymarcher";
import { QuantumMorphingSwarm } from "./QuantumMorphingSwarm";

// ─── Scene Setup ───
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

// ─── Main Composition ───
export const ExtraordinaryWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const frame = useCurrentFrame();
    const [backendInfo, setBackendInfo] = useState("Detecting...");

    const handleBackend = useCallback((info: string) => {
        setBackendInfo(info);
    }, []);

    return (
        <AbsoluteFill style={{ background: "#050508" }}>
            <WebGPUCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 7], fov: 50 }}
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
                <SceneSetup onBackend={handleBackend}>
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

            {/* Demo label */}
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
                {frame < 50
                    ? "1/6: Liquid Iridescent Plasma Blob"
                    : frame < 100
                        ? "2/6: Synthwave Neon Grid Terrain"
                        : frame < 150
                            ? "3/6: Flow-Field GPU Particle Swarm"
                            : frame < 200
                                ? "4/6: Galactic Point Cloud Nebula"
                                : frame < 250
                                    ? "5/6: Mandelbulb Raymarcher"
                                    : "6/6: Quantum Geometry Morphing"}
            </div>
        </AbsoluteFill>
    );
};
