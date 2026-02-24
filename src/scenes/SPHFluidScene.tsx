import * as THREE from "three/webgpu";
import {
    color,
    mix,
    uniform,
    float,
    vec3,
    positionLocal,
    normalize,
    sub,
    length,
    instanceIndex,
    Fn,
    storage,
    Loop,
    If,
    distance,
    step,
    uint,
    int,
    atomicAdd,
    atomicStore,
    vec4,
    dot,
    max,
    min,
    clamp
} from "three/tsl";
import { WebGPUCanvas } from "../components/Canvas/WebGPUCanvas";
import { BackendDetector } from "../components/Canvas/BackendDetector";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { useMemo, useRef, useState, useCallback } from "react";
import { extend, useFrame, useThree } from "@react-three/fiber";

extend(THREE as any);

const P_COUNT = 32768;

// Grid parameters
const GRID_RES = 64;
const TOTAL_CELLS = GRID_RES * GRID_RES * GRID_RES;
const MAX_PER_CELL = 8; // Max particles tracked per cell to avoid arbitrary length lists
const GRID_SIZE = 40.0;
const CELL_SIZE = GRID_SIZE / GRID_RES;

function SPHCompute() {
    const { gl } = useThree();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const {
        positionBuffer,
        velocityBuffer,
        clearGridNode,
        hashGridNode,
        sphForceNode,
        integrateNode
    } = useMemo(() => {
        // --- 1. Initialize Buffers ---
        const basePositions = new Float32Array(P_COUNT * 4);
        const baseVelocities = new Float32Array(P_COUNT * 4);

        for (let i = 0; i < P_COUNT; i++) {
            // Drop them in a column
            basePositions[i * 4 + 0] = (Math.random() - 0.5) * 10;
            basePositions[i * 4 + 1] = Math.random() * 20;
            basePositions[i * 4 + 2] = (Math.random() - 0.5) * 10;
            basePositions[i * 4 + 3] = 1;

            baseVelocities[i * 4 + 0] = 0;
            baseVelocities[i * 4 + 1] = 0;
            baseVelocities[i * 4 + 2] = 0;
            baseVelocities[i * 4 + 3] = 0;
        }

        const posStorage = storage(new THREE.StorageInstancedBufferAttribute(basePositions, 4), 'vec4', P_COUNT);
        const velStorage = storage(new THREE.StorageInstancedBufferAttribute(baseVelocities, 4), 'vec4', P_COUNT);

        // Spatial Grid Buffers
        // cellCounts tracks how many particles are currently in this cell (using atomic ops)
        const cellCountsArray = new Uint32Array(TOTAL_CELLS);
        const cellCountsStorage = storage(new THREE.StorageBufferAttribute(cellCountsArray, 1), 'uint', TOTAL_CELLS);

        // cellParticles stores the IDs of the particles in that cell. Flattened: [TOTAL_CELLS * MAX_PER_CELL]
        const cellParticlesArray = new Uint32Array(TOTAL_CELLS * MAX_PER_CELL);
        const cellParticlesStorage = storage(new THREE.StorageBufferAttribute(cellParticlesArray, 1), 'uint', TOTAL_CELLS * MAX_PER_CELL);

        // --- 2. Helper Functions ---
        const getGridIndex = (pos: any) => {
            // Map position from [-GRID_SIZE/2, GRID_SIZE/2] to [0, GRID_RES-1]
            const gridCoord = pos.add(GRID_SIZE / 2.0).div(CELL_SIZE);
            const gx = clamp(int(gridCoord.x), int(0), int(GRID_RES - 1));
            const gy = clamp(int(gridCoord.y), int(0), int(GRID_RES - 1));
            const gz = clamp(int(gridCoord.z), int(0), int(GRID_RES - 1));
            return gz.mul(GRID_RES * GRID_RES).add(gy.mul(GRID_RES)).add(gx);
        };

        // --- PASS 1: Clear Grid ---
        const clearGrid = Fn(() => {
            const idx = instanceIndex;
            // In a real scenario we use atomicStore, but setting element to 0 works in isolated passes
            cellCountsStorage.element(idx).assign(uint(0));
        });

        // --- PASS 2: Hash Particles into Grid ---
        const hashGrid = Fn(() => {
            const pId = instanceIndex;
            const pos = posStorage.element(pId).xyz;

            const cellIdx = getGridIndex(pos);

            // Atomic Add to safely increment the counter for this cell across all parallel threads
            const count = atomicAdd(cellCountsStorage.element(cellIdx), uint(1));

            // If there's room in our fixed-size bucket, store our particle ID
            If(count.lessThan(uint(MAX_PER_CELL)), () => {
                const flatIndex = cellIdx.mul(uint(MAX_PER_CELL)).add(count);
                cellParticlesStorage.element(flatIndex).assign(uint(pId));
            });
        });

        // --- PASS 3: SPH Physics (Repulsion & Fluidity) ---
        const P_RADIUS = float(1.2);
        const FORCE_SCALAR = float(0.02);

        const sphForce = Fn(() => {
            const pId = instanceIndex;
            const pos = posStorage.element(pId).xyz;
            const vel = velStorage.element(pId).xyz;

            const force = vec3(0).toVar();

            // We find our grid coordinates to loop over 3x3x3 neighbors
            const gridCoord = pos.add(GRID_SIZE / 2.0).div(CELL_SIZE);
            const cx = clamp(int(gridCoord.x), int(0), int(GRID_RES - 1));
            const cy = clamp(int(gridCoord.y), int(0), int(GRID_RES - 1));
            const cz = clamp(int(gridCoord.z), int(0), int(GRID_RES - 1));

            // Loop 3x3x3 cells
            Loop({ type: 'int', start: -1, end: 2 }, ({ i: zOff }) => {
                Loop({ type: 'int', start: -1, end: 2 }, ({ i: yOff }) => {
                    Loop({ type: 'int', start: -1, end: 2 }, ({ i: xOff }) => {

                        const nx = clamp(cx.add(xOff), int(0), int(GRID_RES - 1));
                        const ny = clamp(cy.add(yOff), int(0), int(GRID_RES - 1));
                        const nz = clamp(cz.add(zOff), int(0), int(GRID_RES - 1));

                        const nCellIdx = nz.mul(GRID_RES * GRID_RES).add(ny.mul(GRID_RES)).add(nx);
                        const pCountInCell = min(cellCountsStorage.element(nCellIdx), uint(MAX_PER_CELL));

                        // Loop particles in that neighbor cell
                        Loop({ type: 'uint', start: 0, end: pCountInCell }, ({ i: pIdx }) => {
                            const flatIdx = uint(nCellIdx).mul(uint(MAX_PER_CELL)).add(pIdx);
                            const otherParticleId = cellParticlesStorage.element(flatIdx);

                            If(otherParticleId.notEqual(uint(pId)), () => {
                                const otherPos = posStorage.element(otherParticleId as any).xyz;
                                const otherVel = velStorage.element(otherParticleId as any).xyz;

                                const dir = pos.sub(otherPos);
                                const dist = length(dir);

                                If(dist.lessThan(P_RADIUS).and(dist.greaterThan(0.001)), () => {
                                    // SPH Pressure (Repulsion) - quadratic falloff
                                    const overlap = P_RADIUS.sub(dist);
                                    const pressure = normalize(dir).mul(overlap.mul(overlap)).mul(FORCE_SCALAR);
                                    force.addAssign(pressure);

                                    // SPH Viscosity (Velocity matching)
                                    const velDiff = otherVel.sub(vel);
                                    force.addAssign(velDiff.mul(0.01));
                                });
                            });
                        });
                    });
                });
            });

            // Store accumulated force in velocity buffer (w channel unused, we can use it, or just add to velocity)
            velStorage.element(pId).xyz = vel.add(force);
        });

        // --- PASS 4: Integration (Gravity & Bounds) ---
        const integrate = Fn(() => {
            const pId = instanceIndex;
            const pos = posStorage.element(pId).xyz;
            const vel = velStorage.element(pId).xyz;

            // Gravity
            vel.addAssign(vec3(0, -0.015, 0));

            // Floor collision
            const FLOOR_Y = float(-15.0);
            If(pos.y.lessThan(FLOOR_Y), () => {
                pos.y = FLOOR_Y;
                vel.y = vel.y.mul(-0.5); // bounce
                vel.x = vel.x.mul(0.9); // friction
                vel.z = vel.z.mul(0.9);
            });

            // Box collision (walls)
            const WALL = float(15.0);
            If(pos.x.lessThan(WALL.negate()), () => { pos.x = WALL.negate(); vel.x = vel.x.mul(-0.5); });
            If(pos.x.greaterThan(WALL), () => { pos.x = WALL; vel.x = vel.x.mul(-0.5); });
            If(pos.z.lessThan(WALL.negate()), () => { pos.z = WALL.negate(); vel.z = vel.z.mul(-0.5); });
            If(pos.z.greaterThan(WALL), () => { pos.z = WALL; vel.z = vel.z.mul(-0.5); });

            // Apply velocity
            // Limit terminal velocity
            const speed = length(vel);
            const clampedVel = normalize(vel).mul(min(speed, float(1.0)));

            velStorage.element(pId).xyz = clampedVel;
            posStorage.element(pId).xyz = pos.add(clampedVel);
        });

        return {
            positionBuffer: posStorage,
            velocityBuffer: velStorage,
            clearGridNode: clearGrid().compute(TOTAL_CELLS),
            hashGridNode: hashGrid().compute(P_COUNT),
            sphForceNode: sphForce().compute(P_COUNT),
            integrateNode: integrate().compute(P_COUNT)
        };
    }, []);

    useFrame(() => {
        const renderer = gl as any;
        // The beauty of WebGPU: Dispatching dependent compute passes sequentially in one frame!
        renderer.compute(clearGridNode);
        renderer.compute(hashGridNode);
        renderer.compute(sphForceNode);
        renderer.compute(integrateNode);
    });

    return { positionBuffer, velocityBuffer };
}

function SPHRenderMesh() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { positionBuffer, velocityBuffer } = SPHCompute();
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const material = useMemo(() => {
        const mat = new THREE.MeshPhysicalNodeMaterial();

        const globalPos = positionBuffer.element(instanceIndex);
        const globalVel = velocityBuffer.element(instanceIndex);

        mat.positionNode = positionLocal.add(globalPos.xyz);

        // Fluid appearance
        mat.colorNode = color("#000000");

        const speed = length(globalVel.xyz);
        const slowColor = color("#0088ff");
        const fastColor = color("#ffffff"); // whitewater when moving fast

        mat.emissiveNode = mix(slowColor, fastColor, speed.mul(2.0).clamp());

        mat.roughnessNode = float(0.0);
        mat.metalnessNode = float(0.1);
        mat.transmission = 0.9;
        mat.ior = 1.33; // Water IOR
        mat.thickness = 1.5;

        return mat;
    }, [positionBuffer, velocityBuffer]);

    const t = frame / fps;
    if (meshRef.current) {
        meshRef.current.rotation.y = t * 0.2;
    }

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, P_COUNT]} material={material}>
            <sphereGeometry args={[0.3, 8, 8]} />
        </instancedMesh>
    );
}

export const SPHFluidWebGPUScene: React.FC = () => {
    const { width, height } = useVideoConfig();
    const [backendInfo, setBackendInfo] = useState("Detecting...");

    const handleBackend = useCallback((info: string) => {
        setBackendInfo(info);
    }, []);

    return (
        <AbsoluteFill style={{ background: "#020205" }}>
            <WebGPUCanvas
                width={width}
                height={height}
                camera={{ position: [0, 5, 40], fov: 45 }}
                gl={async (defaultProps: any) => {
                    const canvas = defaultProps.canvas as HTMLCanvasElement;
                    const renderer = new THREE.WebGPURenderer({
                        canvas,
                        antialias: true,
                    });
                    await renderer.init();
                    return renderer as any;
                }}
            >
                <BackendDetector onDetect={handleBackend} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 20, 10]} intensity={1.5} color="#ffffff" />

                <SPHRenderMesh />

                {/* Glass container box visualization */}
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[30, 30, 30]} />
                    <meshPhysicalMaterial
                        color="#ffffff"
                        transparent={true}
                        opacity={0.05}
                        roughness={0.1}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </WebGPUCanvas>

            {/* UI Overlays */}
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    fontFamily: "monospace",
                    fontSize: 16,
                    color: backendInfo.includes("WebGPU") ? "#00ff88" : "#ff4444",
                    background: "rgba(0,0,0,0.7)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: `1px solid ${backendInfo.includes("WebGPU") ? "#00ff88" : "#ff4444"}`,
                }}
            >
                Renderer: {backendInfo}
            </div>

            <div
                style={{
                    position: "absolute",
                    bottom: 20,
                    left: 20,
                    fontFamily: "monospace",
                    fontSize: 18,
                    color: "#fff",
                    background: "rgba(0,0,0,0.7)",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.2)"
                }}
            >
                WebGPU Atomic Spatial Hash Grid (Real-Time SPH Fluid Simulation)
            </div>
        </AbsoluteFill>
    );
};
