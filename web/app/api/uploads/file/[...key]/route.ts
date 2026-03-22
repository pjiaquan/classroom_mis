import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { query } from "@/lib/db/client";
import {
  isValidUploadSignature,
  resolveUploadAbsolutePath,
} from "@/lib/uploads/service";

type RouteContext = {
  params: Promise<{
    key: string[];
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const { key } = await context.params;
  const storageKey = key.join("/");
  const absolutePath = resolveUploadAbsolutePath(storageKey);

  if (!absolutePath) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  try {
    const isAdmin = await isAdminSessionAuthenticated();
    const signature = new URL(request.url).searchParams.get("sig");

    if (!isAdmin && (!signature || !isValidUploadSignature(storageKey, signature))) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const metadataResult = await query<{
      mime_type: string | null;
      original_filename: string | null;
    }>(
      `
        SELECT mime_type, original_filename
        FROM submission_files
        WHERE storage_key = $1
        LIMIT 1
      `,
      [storageKey],
    );

    if (metadataResult.rowCount === 0) {
      return new NextResponse("Not found", { status: 404 });
    }

    const file = await readFile(absolutePath);
    const metadata = metadataResult.rows[0];
    const mimeType = metadata.mime_type || "application/octet-stream";
    const originalFilename = metadata.original_filename || "download.bin";
    const disposition = mimeType.startsWith("image/") ? "inline" : "attachment";

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(
          originalFilename,
        )}`,
        "Cache-Control": "private, max-age=0, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
