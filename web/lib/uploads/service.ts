import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { type SubmissionStoredFile } from "@/lib/forms/types";

const uploadRoot = path.join(process.cwd(), "..", "data", "form_uploads");

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function persistUploadedFile(input: {
  formSlug: string;
  fieldKey: string;
  file: File;
}): Promise<SubmissionStoredFile> {
  const safeFormSlug = sanitizeSegment(input.formSlug);
  const safeFieldKey = sanitizeSegment(input.fieldKey);
  const safeName = sanitizeSegment(input.file.name || "upload.bin");
  const storageKey = path.posix.join(
    safeFormSlug,
    safeFieldKey,
    `${Date.now()}-${randomUUID()}-${safeName}`,
  );
  const absolutePath = path.join(uploadRoot, storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    fieldKey: input.fieldKey,
    storageKey,
    originalFilename: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    fileSizeBytes: input.file.size,
    publicUrl: `/api/uploads/file/${storageKey}`,
  };
}

export async function createUploadIntent() {
  return {
    ok: false as const,
    statusCode: 501,
    error:
      "Direct multipart form submission is enabled. Presigned upload is not wired in this local-storage implementation.",
  };
}
