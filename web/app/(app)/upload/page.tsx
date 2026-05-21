import { UploadClient } from "./UploadClient";

export default function UploadPage() {
  return (
    <div className="fade-in">
      <div
        className="mono"
        style={{
          border: "1px solid var(--border-2)",
          background: "var(--off)",
          color: "var(--muted)",
          padding: "10px 14px",
          borderRadius: 4,
          fontSize: 11,
          lineHeight: 1.6,
          marginBottom: 16,
          maxWidth: 540,
        }}
      >
        First upload after a quiet period takes ~30s while the GPU warms up. Subsequent uploads finish in ~10s.
      </div>
      <UploadClient />
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7, maxWidth: 460, marginTop: 16 }}>
        Qwen2.5-VL reads the invoice image directly → vendor matched (or created) via GST number → fields populated. Low-confidence extractions land in <span style={{ color: "var(--amber)" }}>review</span>.
      </div>
    </div>
  );
}
