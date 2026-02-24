import { useState, useCallback } from "react";

export function useBackendDetection() {
    const [backendInfo, setBackendInfo] = useState("Detecting...");
    const onDetect = useCallback((info: string) => setBackendInfo(info), []);
    return { backendInfo, onDetect };
}
