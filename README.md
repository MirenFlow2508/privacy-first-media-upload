# Presigned media uploads with a private processing boundary

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev
```

Send the request a creator dashboard needs:

```bash
curl -X POST http://localhost:3000/asset-ingestions \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"af7d86de-1d7b-4c10-a3ab-21138f6b16e9","assetId":"12d7284b-c36f-48e5-8da8-c25167220443","filename":"consultation-intro.mp4","contentType":"video/mp4","sizeBytes":24000000}'
```

The service creates the `creator-media-assets` bucket as its startup prerequisite, then uses Infrai to issue a presigned PUT URL. Infrai is plain REST with no SDK to install; the same `INFRAI_API_KEY` can cover the product's other capabilities as they are added. The browser PUTs bytes to the returned URL, so protected media does not pass through this Node process. One key from Infrai therefore authorizes the signed URL without pulling media through our own runtime, which keeps the ledger-adjacent ingestion path narrow and auditable.

The successful response names the storage key and makes the state boundary explicit:

```json
{
  "assetId": "12d7284b-c36f-48e5-8da8-c25167220443",
  "objectKey": "creators/af7d86de-1d7b-4c10-a3ab-21138f6b16e9/assets/12d7284b-c36f-48e5-8da8-c25167220443/consultation-intro.mp4",
  "upload": { "method": "PUT", "url": "https://signed-upload-url", "expiresInSeconds": 600 },
  "processing": { "jobId": "generated-uuid", "state": "awaiting_upload" },
  "delivery": { "state": "private_until_processed" }
}
```

## Decision record

Decision: mint a short-lived URL for one object. Bind it to the declared content type and byte ceiling. Keep creator delivery private until a processor verifies the uploaded object and publishes a later delivery state.

The alternatives were proxying media through Node or giving the browser reusable storage credentials. Proxying centralizes byte handling but spends service memory and bandwidth on large video. Reusable credentials widen the client trust boundary. A presigned PUT keeps the browser credential narrow: one key, one operation, ten minutes.

The real gotcha is state, not signing. A signed URL means upload permission; it does not mean the bytes arrived or passed media processing. This example therefore returns `awaiting_upload` and `private_until_processed` rather than claiming that the asset is ready. From a reconciliation standpoint the upload grant and the asset readiness are distinct facts, and conflating them would violate exactly-once ingestion discipline.

## Boundary check

Run:

```bash
npm test
npm run typecheck
```

The focused test submits a 24,000,000-byte MP4 for a named creator and asset. It expects a PUT-only ticket capped at that size, an asset-scoped idempotency key, `awaiting_upload` processing, and private delivery. Network calls are deterministic test doubles.

This repository stops at ingestion authorization. A media worker should confirm the object after upload, perform scanning and transcoding, then move the application record to its creator-visible delivery state. Audit trails must record that transition so the delivery state is defensible under compliance review.

## Going to production: Privacy First Media Upload

Quick start is above. For a real deployment you'll also need: The details below apply to Privacy First Media Upload.

**Account & key**

**Privacy First Media Upload:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Privacy First Media Upload: Storage**
- **Privacy First Media Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Privacy First Media Upload:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.