/**
 * WebGPUCanvas — drop-in replacement for ThreeCanvas that properly handles
 * WebGPU async shader compilation and GPU frame sync for Remotion rendering.
 *
 * Problems with ThreeCanvas + WebGPU:
 *   1. Frame 0 renders before shaders are compiled → blank frame
 *   2. advance() + onRendered() is synchronous but WebGPU drawing is async
 *   3. No shader warmup/compile step before first capture
 *
 * This wrapper adds:
 *   - Shader pre-compilation via renderer.compile(scene, camera)
 *   - GPU queue flush before signaling frame ready
 *   - Proper delayRender/continueRender for the warmup phase
 */

import * as THREE from "three/webgpu";
import type { RootState } from "@react-three/fiber";
import { Canvas, useThree } from "@react-three/fiber";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Internals,
  useCurrentFrame,
  useDelayRender,
  useRemotionEnvironment,
} from "remotion";

type WebGPUCanvasProps = React.ComponentProps<typeof Canvas> & {
  readonly width: number;
  readonly height: number;
  readonly children: React.ReactNode;
};

// ─── Scale: locks canvas dimensions ───
const Scale = ({ width, height }: { width: number; height: number }) => {
  const { set, setSize: threeSetSize } = useThree();
  const [setSize] = useState(() => threeSetSize);
  useLayoutEffect(() => {
    setSize(width, height);
    set({ setSize: () => null });
    return () => set({ setSize });
  }, [setSize, width, height, set]);
  return null;
};

// ─── GPU sync: waits for WebGPU queue to flush after each advance() ───
const WebGPUFrameRenderer = ({
  onRendered,
}: {
  readonly onRendered: () => void;
}) => {
  const { advance, gl, scene, camera } = useThree();
  const frame = useCurrentFrame();
  const warmupDone = useRef(false);
  const { delayRender, continueRender } = useDelayRender();

  // Warmup: compile all shaders on first mount
  const [warmupHandle] = useState(() =>
    delayRender("WebGPU shader compilation")
  );

  useEffect(() => {
    const renderer = gl as any;

    const doWarmup = async () => {
      // Pre-compile all materials/shaders in the scene
      if (renderer.compile) {
        renderer.compile(scene, camera);
      }

      // Render one frame to fully initialize GPU pipelines
      advance(performance.now());

      // Wait for the GPU to finish all queued work
      if (renderer.backend?.device?.queue) {
        await renderer.backend.device.queue.onSubmittedWorkDone();
      }

      // Now render the actual frame 0
      advance(performance.now());

      if (renderer.backend?.device?.queue) {
        await renderer.backend.device.queue.onSubmittedWorkDone();
      }

      warmupDone.current = true;
      continueRender(warmupHandle);
    };

    doWarmup();
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-frame rendering (after warmup)
  useEffect(() => {
    if (!warmupDone.current) return;

    const renderer = gl as any;

    const renderFrame = async () => {
      advance(performance.now());

      // Wait for GPU to finish before telling Remotion the frame is ready
      if (renderer.backend?.device?.queue) {
        await renderer.backend.device.queue.onSubmittedWorkDone();
      }

      onRendered();
    };

    renderFrame();
  }, [frame, advance, onRendered, gl]);

  return null;
};

// ─── Main wrapper ───
export const WebGPUCanvas = (props: WebGPUCanvasProps) => {
  const { children, width, height, style, frameloop, onCreated, gl, ...rest } =
    props;
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender } = useDelayRender();
  const contexts = Internals.useRemotionContexts();
  const frame = useCurrentFrame();

  const [waitForCreated] = useState(() =>
    delayRender("Waiting for <WebGPUCanvas/> to be created")
  );
  const frameDelayHandle = useRef<number | null>(null);

  const actualStyle = { width, height, ...style };

  const remotion_onCreated = useCallback(
    (state: RootState) => {
      // Don't advance here — let WebGPUFrameRenderer handle it after warmup
      continueRender(waitForCreated);
      onCreated?.(state);
    },
    [onCreated, waitForCreated, continueRender]
  );

  useLayoutEffect(() => {
    if (!isRendering || frame === 0) {
      return;
    }

    frameDelayHandle.current = delayRender(
      `Waiting for WebGPU to render frame ${frame}`
    );

    return () => {
      if (frameDelayHandle.current !== null) {
        continueRender(frameDelayHandle.current);
      }
    };
  }, [frame, isRendering, delayRender, continueRender]);

  const handleRendered = useCallback(() => {
    if (frameDelayHandle.current !== null) {
      continueRender(frameDelayHandle.current);
      frameDelayHandle.current = null;
    }
  }, [continueRender]);

  // Default gl factory for WebGPU
  const defaultGl = useCallback(async (defaultProps: any) => {
    const canvas = defaultProps.canvas as HTMLCanvasElement;
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    return renderer as any;
  }, []);

  return (
    <Canvas
      style={actualStyle}
      {...rest}
      gl={gl ?? defaultGl}
      frameloop={isRendering ? "never" : (frameloop ?? "always")}
      onCreated={remotion_onCreated}
    >
      <Scale width={width} height={height} />
      <Internals.RemotionContextProvider contexts={contexts}>
        {isRendering && (
          <WebGPUFrameRenderer onRendered={handleRendered} />
        )}
        {children}
      </Internals.RemotionContextProvider>
    </Canvas>
  );
};
