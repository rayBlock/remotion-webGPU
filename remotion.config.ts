import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// WebGPU/Three.js rendering: ANGLE gives full GPU access in headless mode.
// Without --gl=angle, headless-shell produces black 3D canvases despite
// WebGPU initializing (tested: 18s black frames vs 2.8s full render).
// Note: this only affects CLI renders, not SSR APIs (pass chromiumOptions there).
Config.setChromiumOpenGlRenderer("angle");
