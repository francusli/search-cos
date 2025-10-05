import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Security: Only allow reading files from the logs directory
    if (!filePath.includes("logs/") || filePath.includes("..")) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Resolve the full path relative to project root
    const fullPath = join(process.cwd(), filePath);

    // Read the file
    const content = await readFile(fullPath, "utf-8");

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Read error:", error);

    if (error.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to read file: " + error.message },
      { status: 500 }
    );
  }
}
