import { float, fract, sin } from "three/tsl";

const HASH_CONSTANTS = [12.9898, 78.233, 39.346, 93.989] as const;
const HASH_SCALE = 43758.5453;

/**
 * Generate a pseudo-random hash seed from a TSL node (typically `float(instanceIndex)`).
 * Uses the classic `fract(sin(id * constant) * 43758.5453)` pattern.
 *
 * @param id - A TSL float node (e.g. `float(instanceIndex)`)
 * @param index - Which hash constant to use (0-3 for x/y/z/w seeds)
 */
export function hashSeed(id: ReturnType<typeof float>, index: 0 | 1 | 2 | 3) {
    return fract(sin(id.mul(HASH_CONSTANTS[index])).mul(HASH_SCALE));
}
