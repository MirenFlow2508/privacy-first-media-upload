import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infrai, InfraiError } from "./infrai_storage";

const MAX_ASSET_BYTES = 500 * 1024 * 1024;
const ASSET_BUCKET = process.env.MEDIA_ASSET_BUCKET ?? "creator-media-assets";

export const uploadRequestSchema = z.object({
  creatorId: z.string().uuid(),
  assetId: z.string().uuid(),
  filename: z.string().min(1).max(180).regex(/^[a-zA-Z0-9._-]+$/),
  contentType: z.enum(["video/mp4", "audio/mpeg", "image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive().max(MAX_ASSET_BYTES),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export type IngestionTicket = {
  assetId: string;
  objectKey: string;
  upload: { method: "PUT"; url: string; expiresInSeconds: number };
  processing: { jobId: string; state: "awaiting_upload" };
  delivery: { state: "private_until_processed" };
};

let bucketReady: Promise<void> | undefined;

async function createAssetBucket(): Promise<void> {
  try {
    await infrai.storage.bucket.create(ASSET_BUCKET);
  } catch (error) {
    if (!(error instanceof InfraiError) || error.status !== 409) throw error;
  }
}

function ensureAssetBucket(): Promise<void> {
  bucketReady ??= createAssetBucket();
  return bucketReady;
}

export async function beginAssetIngestion(input: UploadRequest): Promise<IngestionTicket> {
  const request = uploadRequestSchema.parse(input);
  await ensureAssetBucket();

  const objectKey = `creators/${request.creatorId}/assets/${request.assetId}/${request.filename}`;
  const idempotencyKey = `asset-upload:${request.assetId}`;
  const expiresInSeconds = 600;
  const signed = await infrai.storage.object.presign(ASSET_BUCKET, objectKey, {
    op: "put",
    expires_seconds: expiresInSeconds,
    content_type: request.contentType,
    max_bytes: request.sizeBytes,
    idempotency_key: idempotencyKey,
  });

  return {
    assetId: request.assetId,
    objectKey,
    upload: { method: "PUT", url: signed.url, expiresInSeconds },
    processing: { jobId: randomUUID(), state: "awaiting_upload" },
    delivery: { state: "private_until_processed" },
  };
}
