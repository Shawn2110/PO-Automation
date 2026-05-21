import { UploadClient } from "./UploadClient";

export default function UploadPage() {
  const ocrConfigured = Boolean(process.env.OCR_SERVICE_URL);

  return (
    <div className="fade-in">
      {!ocrConfigured && (
        <div
          className="mono"
          style={{
            border: "1px solid var(--amber)",
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            color: "var(--amber)",
            padding: "10px 14px",
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.6,
            marginBottom: 16,
            maxWidth: 540,
          }}
        >
          OCR sidecar not deployed yet — drag-and-drop works, but uploads will land in <span style={{ textTransform: "lowercase" }}>error</span> status until the Python service is wired up (Phase 2).
        </div>
      )}
      <UploadClient />
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7, maxWidth: 460, marginTop: 16 }}>
        PaddleOCR extracts text → vendor matched via GST number → saved template applied → 5 fields extracted.
        New vendors are flagged for one-time mapping. Low-confidence extractions land in <span style={{ color: "var(--amber)" }}>review</span>.
      </div>
    </div>
  );
}
