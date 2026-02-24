/**
 * WebGPUSync — a component that goes INSIDE <ThreeCanvas> to handle
 * WebGPU's async shader compilation and GPU frame synchronization.
 *
 * The problem:
 *   ThreeCanvas.ManualFrameRenderer calls advance() then immediately
 *   calls onRendered() → continueRender(). But with WebGPU:
 *     1. queue.submit() returns before the GPU finishes drawing
 *     2. First renders trigger WGSL shader compilation (async pipeline creation)
 *   So Remotion captures the canvas before pixels are actually there.
 *
 * The fix:
 *   This component uses delayRender/continueRender to:
 *     1. On mount: pre-compile all shaders via renderer.compile(scene, camera)
 *        and do a warmup render + GPU flush before allowing frame 0
 *     2. Each frame: wait for device.queue.onSubmittedWorkDone() after the
 *        R3F advance() has submitted GPU work, before letting Remotion capture
 *
 * Usage:
 *   <ThreeCanvas ...>
 *     <WebGPUSync />
 *     <YourScene />
 *   </ThreeCanvas>
 */

import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { useCurrentFrame, useDelayRender } from "remotion";

export const WebGPUSync: React.FC = () => {
  const { gl, scene, camera, advance } = useThree();
  const frame = useCurrentFrame();
  const warmupDone = useRef(false);
  const { delayRender, continueRender } = useDelayRender();

  // ─── Warmup: pre-compile shaders before frame 0 is captured ───
  const [warmupHandle] = useState(() =>
    delayRender("WebGPU shader compilation warmup", {
      timeoutInMilliseconds: 60000,
    })
  );

  useEffect(() => {
    const renderer = gl as any;

    const doWarmup = async () => {
      try {
        // Step 1: Pre-compile all shader pipelines in the scene
        // renderer.compile() is an alias for compileAsync() in Three.js r171+
        // It calls device.createRenderPipelineAsync() for every material
        if (renderer.compile) {
          await renderer.compile(scene, camera);
        }

        // Step 2: Do a warmup render to fully initialize all GPU state
        advance(performance.now());

        // Step 3: Wait for GPU to finish the warmup render
        if (renderer.waitForGPU) {
          await renderer.waitForGPU();
        } else if (renderer.backend?.device?.queue) {
          await renderer.backend.device.queue.onSubmittedWorkDone();
        }

        // Step 4: Render the actual frame 0 with everything compiled
        advance(performance.now());

        if (renderer.waitForGPU) {
          await renderer.waitForGPU();
        } else if (renderer.backend?.device?.queue) {
          await renderer.backend.device.queue.onSubmittedWorkDone();
        }

        warmupDone.current = true;
        continueRender(warmupHandle);
      } catch (err) {
        console.error("WebGPU warmup failed:", err);
        // Still continue so we don't hang forever
        warmupDone.current = true;
        continueRender(warmupHandle);
      }
    };

    doWarmup();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Per-frame GPU sync: wait for GPU after each advance() ───
  useEffect(() => {
    if (!warmupDone.current) return;

    const renderer = gl as any;
    const handle = delayRender(`WebGPU GPU sync frame ${frame}`, {
      timeoutInMilliseconds: 30000,
    });

    const syncGPU = async () => {
      // ThreeCanvas's ManualFrameRenderer has already called advance()
      // which submitted GPU commands via queue.submit(). We need to wait
      // for the GPU to actually finish before Remotion captures the canvas.
      if (renderer.waitForGPU) {
        await renderer.waitForGPU();
      } else if (renderer.backend?.device?.queue) {
        await renderer.backend.device.queue.onSubmittedWorkDone();
      }

      continueRender(handle);
    };

    syncGPU();
  }, [frame, gl, delayRender, continueRender]);

  return null;
};
