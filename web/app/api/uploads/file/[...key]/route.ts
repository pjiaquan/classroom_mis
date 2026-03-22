import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const uploadRoot = path.join(process.cwd(), "..", "data", "form_uploads");

type RouteContext = {
  params: Promise<{
    key: string[];
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { key } = await context.params;
  const storageKey = key.join("/");
  const absolutePath = path.join(uploadRoot, storageKey);

  if (!absolutePath.startsWith(uploadRoot)) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  try {
    const file = await readFile(absolutePath);
    return new NextResponse(file, {
      status: 200,
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
