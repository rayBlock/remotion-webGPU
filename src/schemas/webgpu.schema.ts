import { z } from "zod/v4";
import { zColor } from "@remotion/zod-types";

export const webGPUSceneSchema = z.object({
  // Global
  background: zColor().default("#0a0a0f"),
  showBackendOverlay: z.boolean().default(true),
  rotationSpeed: z.number().min(0).max(5).default(1),
  cameraDistance: z.number().min(2).max(15).default(5),

  // Demo selection
  demo: z
    .enum([
      "noiseDisplacement",
      "fresnelCrystal",
      "proceduralTorus",
      "holographicRibbon",
    ])
    .default("noiseDisplacement"),

  // Noise displacement sphere params
  noiseDisplacement: z.object({
    warmColor: zColor().default("#ff4500"),
    coolColor: zColor().default("#1e90ff"),
    displacementStrength: z.number().min(0).max(1).default(0.3),
    noiseScale: z.number().min(0.5).max(8).default(2),
    octaves: z.number().min(1).max(8).default(4),
    roughness: z.number().min(0).max(1).default(0.2),
    metalness: z.number().min(0).max(1).default(0.8),
    iridescence: z.boolean().default(true),
  }),

  // Fresnel crystal params
  fresnelCrystal: z.object({
    crystalColor: zColor().default("#00ffcc"),
    rimColor: zColor().default("#ff00ff"),
    baseColor: zColor().default("#001122"),
    fresnelPower: z.number().min(0.5).max(8).default(3),
    worleyScale: z.number().min(0.5).max(10).default(3),
    transmission: z.number().min(0).max(1).default(0.3),
    ior: z.number().min(1).max(3).default(2),
  }),

  // Procedural torus params
  proceduralTorus: z.object({
    colorA: zColor().default("#ffdd00"),
    colorB: zColor().default("#220044"),
    checkerScale: z.number().min(1).max(20).default(6),
    noiseDistortion: z.number().min(0).max(1).default(0.3),
  }),

  // Holographic ribbon params
  holographicRibbon: z.object({
    waveAmplitude: z.number().min(0).max(0.5).default(0.15),
    waveFrequency: z.number().min(1).max(10).default(4),
    rainbowSpeed: z.number().min(0).max(2).default(0.2),
    emissiveStrength: z.number().min(0).max(2).default(0.4),
  }),
});

export type WebGPUSceneProps = z.infer<typeof webGPUSceneSchema>;
