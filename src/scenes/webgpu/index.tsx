import "../../utils/extendThree";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig, AbsoluteFill } from "remotion";
import { WebGPUSync } from "../../WebGPUSync";
import type { WebGPUSceneProps } from "../../schemas";
import { BackendDetector, BackendOverlay } from "../../components";
import { useBackendDetection } from "../../hooks";
import { createWebGPURenderer } from "../../utils";
import { NoiseDisplacementSphere } from "./NoiseDisplacementSphere";
import { FresnelCrystal } from "./FresnelCrystal";
import { ProceduralTorus } from "./ProceduralTorus";
import { HolographicRibbon } from "./HolographicRibbon";

const DEMOS = {
    noiseDisplacement: NoiseDisplacementSphere,
    fresnelCrystal: FresnelCrystal,
    proceduralTorus: ProceduralTorus,
    holographicRibbon: HolographicRibbon,
} as const;

const DEMO_LABELS: Record<string, string> = {
    noiseDisplacement: "TSL Fractal Noise Vertex Displacement + Iridescence",
    fresnelCrystal: "TSL Worley Noise + Fresnel + Transmission",
    proceduralTorus: "TSL Checker + Noise Distortion",
    holographicRibbon: "TSL Vertex Waves + Holographic Rainbow",
};

export const WebGPUScene: React.FC<WebGPUSceneProps> = (props) => {
    const {
        background,
        showBackendOverlay,
        rotationSpeed,
        cameraDistance,
        demo,
    } = props;
    const { width, height } = useVideoConfig();
    const { backendInfo, onDetect } = useBackendDetection();

    const DemoComponent = DEMOS[demo];
    const demoParams = props[demo];

    return (
        <AbsoluteFill style={{ background }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, cameraDistance], fov: 50 }}
                gl={createWebGPURenderer}
            >
                <WebGPUSync />
                <BackendDetector onDetect={onDetect} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} />
                <directionalLight position={[-3, 2, -5]} intensity={0.5} color="#4488ff" />
                <DemoComponent params={demoParams as any} rotationSpeed={rotationSpeed} />
            </ThreeCanvas>

            {showBackendOverlay && <BackendOverlay info={backendInfo} />}

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    fontFamily: "monospace",
                    fontSize: 14,
                    color: "#888",
                    background: "rgba(0,0,0,0.7)",
                    padding: "6px 12px",
                    borderRadius: 6,
                }}
            >
                {DEMO_LABELS[demo]}
            </div>
        </AbsoluteFill>
    );
};
