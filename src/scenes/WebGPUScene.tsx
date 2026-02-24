import * as THREE from "three/webgpu";
import {
  color,
  mix,
  uv,
  uniform,
  float,
  sin,
  cos,
  vec3,
  vec2,
  positionLocal,
  normalLocal,
  normalWorld,
  cameraPosition,
  positionWorld,
  mx_noise_float,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  checker,
  normalize,
  dot,
  pow,
  abs,
  sub,
  fract,
} from "three/tsl";
import { ThreeCanvas } from "@remotion/three";
import { WebGPUSync } from "../WebGPUSync";
import { extend, type ThreeToJSXElements } from "@react-three/fiber";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
} from "remotion";
import { useMemo } from "react";
import type { WebGPUSceneProps } from "../schemas";
import { BackendDetector, BackendOverlay } from "../components";
import { useBackendDetection } from "../hooks";
import { createWebGPURenderer } from "../utils";

// Register three/webgpu classes with R3F
declare module "@react-three/fiber" {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> { }
}
extend(THREE as any);

// ─── 1. Fractal noise vertex displacement sphere ───
function NoiseDisplacementSphere({
  params,
  rotationSpeed,
}: {
  params: WebGPUSceneProps["noiseDisplacement"];
  rotationSpeed: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { material, timeU, warmU, coolU, strengthU, scaleU } = useMemo(() => {
    const timeU = uniform(float(0));
    const warmU = uniform(color(params.warmColor));
    const coolU = uniform(color(params.coolColor));
    const strengthU = uniform(float(params.displacementStrength));
    const scaleU = uniform(float(params.noiseScale));

    const mat = new THREE.MeshPhysicalNodeMaterial();
    const noiseInput = positionLocal.mul(scaleU).add(vec3(0, 0, timeU));
    const displacement = mx_fractal_noise_float(
      noiseInput, params.octaves, float(2.0), float(0.5), float(1.0)
    );
    mat.positionNode = positionLocal.add(normalLocal.mul(displacement.mul(strengthU)));
    mat.colorNode = mix(coolU, warmU, displacement.add(0.5).clamp());
    mat.roughnessNode = float(params.roughness);
    mat.metalnessNode = float(params.metalness);
    if (params.iridescence) {
      mat.iridescence = 1.0;
      mat.iridescenceIOR = 1.5;
    }
    return { material: mat, timeU, warmU, coolU, strengthU, scaleU };
  }, [params.octaves, params.roughness, params.metalness, params.iridescence]);

  const t = frame / fps;
  timeU.value = t * 0.5;
  warmU.value.set(params.warmColor);
  coolU.value.set(params.coolColor);
  strengthU.value = params.displacementStrength;
  scaleU.value = params.noiseScale;

  const rotY = t * 0.3 * rotationSpeed;

  return (
    <mesh rotation={[0, rotY, 0]} material={material}>
      <icosahedronGeometry args={[1.5, 64]} />
    </mesh>
  );
}

// ─── 2. Fresnel + Worley noise crystal ───
function FresnelCrystal({
  params,
  rotationSpeed,
}: {
  params: WebGPUSceneProps["fresnelCrystal"];
  rotationSpeed: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { material, timeU, crystalU, rimU, baseU, fresnelPowU, worleyScaleU } = useMemo(() => {
    const timeU = uniform(float(0));
    const crystalU = uniform(color(params.crystalColor));
    const rimU = uniform(color(params.rimColor));
    const baseU = uniform(color(params.baseColor));
    const fresnelPowU = uniform(float(params.fresnelPower));
    const worleyScaleU = uniform(float(params.worleyScale));

    const mat = new THREE.MeshPhysicalNodeMaterial();
    const viewDir = normalize(sub(cameraPosition, positionWorld));
    const fresnel = pow(sub(float(1.0), abs(dot(normalWorld, viewDir))), fresnelPowU);
    const worleyInput = positionLocal.mul(worleyScaleU).add(vec3(timeU.mul(0.2), 0, 0));
    const worley = mx_worley_noise_float(worleyInput);
    const cellColor = mix(baseU, crystalU, worley);
    mat.colorNode = mix(cellColor, rimU, fresnel);
    mat.emissiveNode = rimU.mul(fresnel.mul(2.0));
    mat.roughnessNode = worley.mul(0.3);
    mat.metalnessNode = float(1.0);
    mat.transmission = params.transmission;
    mat.thickness = 1.0;
    mat.ior = params.ior;
    return { material: mat, timeU, crystalU, rimU, baseU, fresnelPowU, worleyScaleU };
  }, [params.transmission, params.ior]);

  const t = frame / fps;
  timeU.value = t;
  crystalU.value.set(params.crystalColor);
  rimU.value.set(params.rimColor);
  baseU.value.set(params.baseColor);
  fresnelPowU.value = params.fresnelPower;
  worleyScaleU.value = params.worleyScale;

  const rotX = t * 0.2 * rotationSpeed;
  const rotY = t * 0.4 * rotationSpeed;

  return (
    <mesh rotation={[rotX, rotY, 0]} material={material}>
      <dodecahedronGeometry args={[1.3, 2]} />
    </mesh>
  );
}

// ─── 3. Procedural checker + noise torus ───
function ProceduralTorus({
  params,
  rotationSpeed,
}: {
  params: WebGPUSceneProps["proceduralTorus"];
  rotationSpeed: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { material, timeU, colAU, colBU, checkerScaleU, distortionU } = useMemo(() => {
    const timeU = uniform(float(0));
    const colAU = uniform(color(params.colorA));
    const colBU = uniform(color(params.colorB));
    const checkerScaleU = uniform(float(params.checkerScale));
    const distortionU = uniform(float(params.noiseDistortion));

    const mat = new THREE.MeshStandardNodeMaterial();
    const uvCoord = uv();
    const noiseVal = mx_noise_float(uvCoord.mul(8.0).add(vec2(timeU.mul(0.5), 0)));
    const distortedUV = uvCoord.mul(checkerScaleU).add(noiseVal.mul(distortionU));
    const check = checker(distortedUV);
    mat.colorNode = mix(colAU, colBU, check);
    mat.roughnessNode = mix(float(0.8), float(0.1), check);
    mat.metalnessNode = mix(float(0.0), float(0.9), check);
    return { material: mat, timeU, colAU, colBU, checkerScaleU, distortionU };
  }, []);

  const t = frame / fps;
  timeU.value = t;
  colAU.value.set(params.colorA);
  colBU.value.set(params.colorB);
  checkerScaleU.value = params.checkerScale;
  distortionU.value = params.noiseDistortion;

  const rotX = Math.PI / 4 + t * 0.3 * rotationSpeed;
  const rotY = t * 0.5 * rotationSpeed;

  return (
    <mesh rotation={[rotX, rotY, 0]} material={material}>
      <torusGeometry args={[1.0, 0.4, 64, 128]} />
    </mesh>
  );
}

// ─── 4. Animated holographic ribbon ───
function HolographicRibbon({
  params,
  rotationSpeed,
}: {
  params: WebGPUSceneProps["holographicRibbon"];
  rotationSpeed: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { material, timeU, ampU, freqU, rainbowSpeedU, emissiveStrU } = useMemo(() => {
    const timeU = uniform(float(0));
    const ampU = uniform(float(params.waveAmplitude));
    const freqU = uniform(float(params.waveFrequency));
    const rainbowSpeedU = uniform(float(params.rainbowSpeed));
    const emissiveStrU = uniform(float(params.emissiveStrength));

    const mat = new THREE.MeshPhysicalNodeMaterial();
    mat.side = THREE.DoubleSide;

    const wave1 = sin(positionLocal.x.mul(freqU).add(timeU.mul(3.0))).mul(ampU);
    const wave2 = cos(positionLocal.z.mul(freqU.mul(0.75)).add(timeU.mul(2.0))).mul(ampU.mul(0.67));
    mat.positionNode = positionLocal.add(vec3(0, wave1.add(wave2), 0));

    const viewDir = normalize(sub(cameraPosition, positionWorld));
    const rim = dot(normalWorld, viewDir);
    const hue = fract(rim.abs().add(positionWorld.x.mul(0.3)).add(timeU.mul(rainbowSpeedU)));
    const r = sin(hue.mul(6.2832)).mul(0.5).add(0.5);
    const g = sin(hue.mul(6.2832).add(2.094)).mul(0.5).add(0.5);
    const b = sin(hue.mul(6.2832).add(4.189)).mul(0.5).add(0.5);
    mat.colorNode = vec3(r, g, b);
    mat.emissiveNode = vec3(r, g, b).mul(emissiveStrU);
    mat.roughnessNode = float(0.1);
    mat.metalnessNode = float(1.0);
    mat.iridescence = 1.0;
    mat.iridescenceIOR = 1.3;
    return { material: mat, timeU, ampU, freqU, rainbowSpeedU, emissiveStrU };
  }, []);

  const t = frame / fps;
  timeU.value = t;
  ampU.value = params.waveAmplitude;
  freqU.value = params.waveFrequency;
  rainbowSpeedU.value = params.rainbowSpeed;
  emissiveStrU.value = params.emissiveStrength;

  const rotY = t * 0.6 * rotationSpeed;

  return (
    <mesh rotation={[0, rotY, 0]} material={material}>
      <planeGeometry args={[4, 2, 128, 64]} />
    </mesh>
  );
}

// ─── Demo map ───
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

// ─── Main composition ───
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

  // Pick the active demo component and its params
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
