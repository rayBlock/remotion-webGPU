export function SceneLabel({ label }: { label: string }) {
    return (
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
                border: "1px solid rgba(255,255,255,0.2)",
            }}
        >
            {label}
        </div>
    );
}
