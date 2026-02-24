import { z } from "zod/v4";
import { zColor } from "@remotion/zod-types";

export const crazyWebGPUSceneSchema = z.object({
  particleCount: z.number().min(5000).max(50000).default(15000),
  boidSpeed: z.number().min(0.01).max(0.5).default(0.1),
  flowNoiseScale: z.number().min(0.1).max(5).default(0.5),
  flowSpeed: z.number().min(0.0).max(1.0).default(0.2),

  // Phase 1 colors
  p1CoreColor: zColor().default("#ff0055"),
  p1EdgeColor: zColor().default("#00ffff"),
  p1SwarmColor: zColor().default("#00ffcc"),
  p1SwarmGlow: zColor().default("#05001a"),

  // Phase 2 colors
  p2CoreColor: zColor().default("#ffcc00"),
  p2EdgeColor: zColor().default("#ff0044"),
  p2SwarmColor: zColor().default("#ffffff"),
  p2SwarmGlow: zColor().default("#440022"),

  // Phase 3 colors
  p3CoreColor: zColor().default("#00ff33"),
  p3EdgeColor: zColor().default("#0044ff"),
  p3SwarmColor: zColor().default("#00ffbb"),
  p3SwarmGlow: zColor().default("#001133"),

  transitionSpeed: z.number().min(0.1).max(5).default(1.5)
});

export type CrazyWebGPUSceneProps = z.infer<typeof crazyWebGPUSceneSchema>;
