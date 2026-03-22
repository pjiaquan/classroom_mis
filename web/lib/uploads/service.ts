import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type SubmissionStoredFile } from "@/lib/forms/types";

const uploadRoot = path.join(process.cwd(), "..", "data", "form_uploads");

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getUploadSigningSecret() {
  return (
    process.env.WEB_UPLOAD_URL_SECRET ||
    process.env.WEB_ADMIN_SESSION_SECRET ||
    process.env.WEB_ADMIN_PASSWORD ||
    process.env.NC_ADMIN_PASSWORD ||
    ""
  );
}

function signStorageKey(storageKey: string) {
  return createHmac("sha256", getUploadSigningSecret())
    .update(storageKey)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildSignedUploadUrl(storageKey: string) {
  const signature = signStorageKey(storageKey);
  return `/api/uploads/file/${storageKey}?sig=${signature}`;
}

export function isValidUploadSignature(storageKey: string, signature: string) {
  const secret = getUploadSigningSecret();
  if (!secret) {
    return false;
  }

  return safeEqual(signature, signStorageKey(storageKey));
}

export function resolveUploadAbsolutePath(storageKey: string) {
  const normalizedStorageKey = storageKey
    .split("/")
    .map((segment) => sanitizeSegment(segment))
    .join(path.sep);
  const absolutePath = path.resolve(uploadRoot, normalizedStorageKey);
  const relativePath = path.relative(uploadRoot, absolutePath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath.length === 0
  ) {
    return null;
  }

  return absolutePath;
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
  const absolutePath = resolveUploadAbsolutePath(storageKey);

  if (!absolutePath) {
    throw new Error("Invalid upload storage key.");
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    fieldKey: input.fieldKey,
    storageKey,
    originalFilename: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    fileSizeBytes: input.file.size,
    publicUrl: buildSignedUploadUrl(storageKey),
  };
}

export async function deleteStoredFile(storageKey: string) {
  const absolutePath = resolveUploadAbsolutePath(storageKey);
  if (!absolutePath) {
    return;
  }

  await rm(absolutePath, { force: true });
}

export async function createUploadIntent() {
  return {
    ok: false as const,
    statusCode: 501,
    error:
      "Direct multipart form submission is enabled. Presigned upload is not wired in this local-storage implementation.",
  };
}
