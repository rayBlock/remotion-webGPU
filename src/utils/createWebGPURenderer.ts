import * as THREE from "three/webgpu";

export async function createWebGPURenderer(defaultProps: any) {
    const canvas = defaultProps.canvas as HTMLCanvasElement;
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    return renderer as any;
}
