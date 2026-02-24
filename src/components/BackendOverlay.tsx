export function BackendOverlay({ info }: { info: string }) {
    const isWebGPU = info.includes("WebGPU");
    const statusColor = isWebGPU ? "#00ff88" : "#ff4444";

    return (
        <div
            style={{
                position: "absolute",
                top: 20,
                left: 20,
                fontFamily: "monospace",
                fontSize: 16,
                color: statusColor,
                background: "rgba(0,0,0,0.7)",
                padding: "8px 14px",
                borderRadius: 6,
                border: `1px solid ${statusColor}`,
            }}
        >
            Renderer: {info}
        </div>
    );
}
