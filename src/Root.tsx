import { Composition } from "remotion";
import { WebGPUScene } from "./scenes/WebGPUScene";
import { webGPUSceneSchema, crazyWebGPUSceneSchema, particleForgeSchema } from "./schemas";
import { ExtraordinaryWebGPUScene } from "./scenes/ExtraordinaryScenes";
import { CrazyScene } from "./scenes/CrazyScene";
import { LimitBreaker } from "./scenes/LimitBreaker";
import { ParticleForge } from "./scenes/ParticleForge";
import { BoidsWebGPUScene } from "./scenes/BoidsScene";
import { SPHFluidWebGPUScene } from "./scenes/SPHFluidScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WebGPUScene"
        component={WebGPUScene}
        schema={webGPUSceneSchema}
        defaultProps={{
          background: "#0a0a0f",
          showBackendOverlay: true,
          rotationSpeed: 1,
          cameraDistance: 5,
          demo: "noiseDisplacement",
          noiseDisplacement: {
            warmColor: "#ff4500",
            coolColor: "#1e90ff",
            displacementStrength: 0.3,
            noiseScale: 2,
            octaves: 4,
            roughness: 0.2,
            metalness: 0.8,
            iridescence: true,
          },
          fresnelCrystal: {
            crystalColor: "#00ffcc",
            rimColor: "#ff00ff",
            baseColor: "#001122",
            fresnelPower: 3,
            worleyScale: 3,
            transmission: 0.3,
            ior: 2,
          },
          proceduralTorus: {
            colorA: "#ffdd00",
            colorB: "#220044",
            checkerScale: 6,
            noiseDistortion: 0.3,
          },
          holographicRibbon: {
            waveAmplitude: 0.15,
            waveFrequency: 4,
            rainbowSpeed: 0.2,
            emissiveStrength: 0.4,
          },
        }}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ExtraordinaryWebGPUScene"
        component={ExtraordinaryWebGPUScene}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="CrazyWebGPUScene"
        component={CrazyScene}
        schema={crazyWebGPUSceneSchema}
        defaultProps={{
          particleCount: 15000,
          boidSpeed: 0.1,
          flowNoiseScale: 0.5,
          flowSpeed: 0.2,
          p1CoreColor: "#ff0055",
          p1EdgeColor: "#00ffff",
          p1SwarmColor: "#00ffcc",
          p1SwarmGlow: "#05001a",
          p2CoreColor: "#ffcc00",
          p2EdgeColor: "#ff0044",
          p2SwarmColor: "#ffffff",
          p2SwarmGlow: "#440022",
          p3CoreColor: "#00ff33",
          p3EdgeColor: "#0044ff",
          p3SwarmColor: "#00ffbb",
          p3SwarmGlow: "#001133",
          transitionSpeed: 1.5
        }}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="LimitBreaker"
        component={LimitBreaker}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ParticleForge"
        component={ParticleForge}
        schema={particleForgeSchema}
        defaultProps={{
          galaxyParticles: 200000,
          galaxyArmTightness: 0.8,
          galaxyCoreColor: "#ffffee",
          galaxyMidColor: "#ff8833",
          galaxyOuterColor: "#4477ff",
          galaxyEdgeColor: "#8833cc",
          morphParticles: 100000,
          sphereColor: "#00ccff",
          cubeColor: "#ff4488",
          torusColor: "#44ff88",
          helixColor: "#ffaa22",
          flowParticles: 150000,
          flowSlowColor: "#0022aa",
          flowMidColor: "#0088ff",
          flowFastColor: "#44ffdd",
          supernovaParticles: 200000,
          supernovaHotColor: "#ffffcc",
          supernovaEmberColor: "#ff6622",
          supernovaCoolColor: "#4488ff",
          auroraParticles: 300000,
          auroraBlueColor: "#001166",
          auroraGreenColor: "#00ff66",
          auroraPurpleColor: "#8800ff",
        }}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="BoidsWebGPUScene"
        component={BoidsWebGPUScene}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SPHFluidWebGPUScene"
        component={SPHFluidWebGPUScene}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
