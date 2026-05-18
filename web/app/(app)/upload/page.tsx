import { UploadClient } from "./UploadClient";

export default function UploadPage() {
  return (
    <div className="fade-in">
      <UploadClient />
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7, maxWidth: 460, marginTop: 16 }}>
        PaddleOCR extracts text → vendor matched via GST number → saved template applied → 5 fields extracted.
        New vendors are flagged for one-time mapping. Low-confidence extractions land in <span style={{ color: "var(--amber)" }}>review</span>.
      </div>
    </div>
  );
}
