import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export function BackendDetector({ onDetect }: { onDetect: (info: string) => void }) {
    const { gl } = useThree();
    useEffect(() => {
        const renderer = gl as any;
        const backendName = renderer?.backend?.constructor?.name ?? "Unknown";
        const isWebGPU = backendName.includes("WebGPU");
        onDetect(`${backendName} ${isWebGPU ? "(native WebGPU)" : "(WebGL fallback)"}`);
    }, [gl, onDetect]);
    return null;
}
