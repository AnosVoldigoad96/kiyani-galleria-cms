export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // sharp needs the Node runtime, not edge
export const maxDuration = 60;

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { requireStaffAccess } from "@/lib/staff-auth";

// Keep in sync with crafts-kiyani-frontend/lib/image-loader.ts and the migration
// script: images are stored as an AVIF ladder <id>/<w>.avif; the DB holds the
// 1600 default and the storefront loader swaps the size segment per request.
const LADDER = [400, 800, 1600];
const DEFAULT_WIDTH = 1600;
const AVIF_QUALITY = 72;
const IMMUTABLE = "public, max-age=31536000, immutable";

function getR2() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_BASE
  ) {
    return null;
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return { client, bucket: R2_BUCKET, base: R2_PUBLIC_BASE.replace(/\/$/, "") };
}

function extFor(type: string, name: string): string {
  if (name.includes(".")) {
    return name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  if (type.includes("/")) {
    return type.split("/")[1].toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  return "bin";
}

export async function POST(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "HASURA_ADMIN_SECRET is not configured." }, { status: 500 });
  }
  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  const store = getR2();
  if (!store) {
    return Response.json({ error: "R2 storage is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = file.type || "";
  const name = file instanceof File ? file.name : "";
  const id = randomUUID();

  try {
    if (type.startsWith("image/")) {
      // Generate the AVIF ladder and upload each rung.
      await Promise.all(
        LADDER.map(async (w) => {
          const avif = await sharp(buf)
            .resize({ width: w, withoutEnlargement: true })
            .avif({ quality: AVIF_QUALITY })
            .toBuffer();
          await store.client.send(
            new PutObjectCommand({
              Bucket: store.bucket,
              Key: `${id}/${w}.avif`,
              Body: avif,
              ContentType: "image/avif",
              CacheControl: IMMUTABLE,
            }),
          );
        }),
      );
      return Response.json({
        fileId: id,
        url: `${store.base}/${id}/${DEFAULT_WIDTH}.avif`,
      });
    }

    // Video / other: store the original as-is (no serverless transcode).
    const ext = extFor(type, name);
    await store.client.send(
      new PutObjectCommand({
        Bucket: store.bucket,
        Key: `${id}/original.${ext}`,
        Body: buf,
        ContentType: type || "application/octet-stream",
        CacheControl: IMMUTABLE,
      }),
    );
    return Response.json({ fileId: id, url: `${store.base}/${id}/original.${ext}` });
  } catch (err) {
    console.error("R2 upload failed:", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const adminSecret = process.env.HASURA_ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ error: "HASURA_ADMIN_SECRET is not configured." }, { status: 500 });
  }
  const authError = await requireStaffAccess(request, adminSecret);
  if (authError) return authError;

  const store = getR2();
  if (!store) {
    return Response.json({ error: "R2 storage is not configured." }, { status: 500 });
  }

  let body: { fileId?: string };
  try {
    body = (await request.json()) as { fileId?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const fileId = body.fileId;
  if (!fileId) {
    return Response.json({ error: "fileId is required." }, { status: 400 });
  }

  // Delete every object under <fileId>/ (the ladder rungs or the original).
  try {
    const listed = await store.client.send(
      new ListObjectsV2Command({ Bucket: store.bucket, Prefix: `${fileId}/` }),
    );
    const objects = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k))
      .map((Key) => ({ Key }));
    if (objects.length) {
      await store.client.send(
        new DeleteObjectsCommand({ Bucket: store.bucket, Delete: { Objects: objects } }),
      );
    }
  } catch (err) {
    // Non-critical: orphaned objects are harmless; the product update proceeds.
    console.error("R2 delete failed:", err);
  }

  return Response.json({ success: true });
}
