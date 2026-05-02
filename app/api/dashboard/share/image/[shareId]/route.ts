import { NextResponse } from "next/server";
import { getShareImage } from "../../../../../lib/share-images";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const image = await getShareImage(shareId);

  if (!image) {
    return NextResponse.json({ error: "Share image not found" }, { status: 404 });
  }

  const body = image.bytes.buffer.slice(
    image.bytes.byteOffset,
    image.bytes.byteOffset + image.bytes.byteLength
  ) as ArrayBuffer;

  return new NextResponse(body, {
    headers: {
      "cache-control": "public, max-age=600",
      "content-type": image.contentType
    }
  });
}
