// Simple local-disk storage adapter. Swap with an S3/MinIO adapter for production.
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads");

export async function saveUploadedPdf(bytes: Buffer): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(fullPath, bytes);
  return fullPath;
}

export function uploadDirRoot(): string {
  return UPLOAD_DIR;
}
