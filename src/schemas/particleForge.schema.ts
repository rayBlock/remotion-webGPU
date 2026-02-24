import { z } from "zod/v4";
import { zColor } from "@remotion/zod-types";

export const particleForgeSchema = z.object({
  // Scene 1: Spiral Galaxy
  galaxyParticles: z.number().min(50000).max(500000).default(200000),
  galaxyArmTightness: z.number().min(0.1).max(2.0).default(0.8),
  galaxyCoreColor: zColor().default("#ffffee"),
  galaxyMidColor: zColor().default("#ff8833"),
  galaxyOuterColor: zColor().default("#4477ff"),
  galaxyEdgeColor: zColor().default("#8833cc"),

  // Scene 2: Morphing Shapes
  morphParticles: z.number().min(25000).max(250000).default(100000),
  sphereColor: zColor().default("#00ccff"),
  cubeColor: zColor().default("#ff4488"),
  torusColor: zColor().default("#44ff88"),
  helixColor: zColor().default("#ffaa22"),

  // Scene 3: Flow Field
  flowParticles: z.number().min(50000).max(300000).default(150000),
  flowSlowColor: zColor().default("#0022aa"),
  flowMidColor: zColor().default("#0088ff"),
  flowFastColor: zColor().default("#44ffdd"),

  // Scene 4: Supernova
  supernovaParticles: z.number().min(50000).max(500000).default(200000),
  supernovaHotColor: zColor().default("#ffffcc"),
  supernovaEmberColor: zColor().default("#ff6622"),
  supernovaCoolColor: zColor().default("#4488ff"),

  // Scene 5: Aurora Veil
  auroraParticles: z.number().min(100000).max(500000).default(300000),
  auroraBlueColor: zColor().default("#001166"),
  auroraGreenColor: zColor().default("#00ff66"),
  auroraPurpleColor: zColor().default("#8800ff"),
});

export type ParticleForgeProps = z.infer<typeof particleForgeSchema>;
