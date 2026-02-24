import * as THREE from 'three/webgpu';
import {
  Fn,
  vec4,
  positionLocal,
  uv,
  uniform,
  mx_fractal_noise_float,
  step,
  color,
  mix,
  float
} from 'three/tsl';

export function createTransitionMaterial(progressU: any, colorA: any, colorB: any) {
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.depthTest = false;

    mat.colorNode = Fn(() => {
        const u = uv();
        // A noise field that controls the wipe shape
        const n = mx_fractal_noise_float(u.mul(10.0), 3, float(2.0), float(0.5), float(1.0));
        
        // Progress goes from 0 to 1
        // We offset the progress by the noise to make the edge jagged and organic
        const threshold = progressU.sub(n.mul(0.2));
        
        // Inside the threshold = solid color B
        const isTransitioned = step(u.x, threshold);
        
        // Glowing leading edge
        const edge = step(u.x, threshold.add(0.05)).sub(isTransitioned);
        
        const finalColor = mix(
            vec4(0, 0, 0, 0), // transparent where not transitioned
            vec4(colorB, 1.0),
            isTransitioned
        ).add(vec4(colorA, 1.0).mul(edge));
        
        return finalColor;
    })();

    return mat;
}
