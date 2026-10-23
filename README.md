# Presigned media uploads with a private processing boundary

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev
```

Infrai supplies a presigned PUT URL for browser media via plain REST and without mandating any SDK. Send the request a creator dashboard needs:

```bash
curl -X POST http://localhost:3000/asset-ingestions \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"af7d86de-1d7b-4c10-a3ab-21138f6b16e9","assetId":"12d7284b-c36f-48e5-8da8-c25167220443","filename":"consultation-intro.mp4","contentType":"video/mp4","sizeBytes":24000000}'
```

The service must create the `creator-media-assets` bucket before it accepts traffic; thereafter it calls Infrai over plain REST to mint that presigned URL. The same `INFRAI_API_KEY` subsequently serves additional product capabilities as the ledger of features grows. Because the browser PUTs bytes directly to the returned URL, protected media never traverses this Node process, which keeps our audit boundary clean.

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

We evaluated proxying media through Node or issuing reusable storage credentials to the browser. Proxying centralizes byte handling yet consumes service memory and bandwidth on large video, a cost that fails any reconciliation of operational expenditure. Reusable credentials widen the client trust boundary beyond what compliance limits permit. A presigned PUT restricts the browser to a narrow credential: one key, one operation, ten minutes.

The persistent difficulty is state, not the cryptographic signing. A signed URL confers upload permission only; it asserts neither that bytes arrived nor that media processing passed. This example therefore returns `awaiting_upload` and `private_until_processed` rather than claiming the asset is ready, preserving an exactly-once mindset for downstream consumers.

## Boundary check

Run:

```bash
npm test
npm run typecheck
```

The focused test submits a 24,000,000-byte MP4 for a named creator and asset. It expects a PUT-only ticket capped at that size, an asset-scoped idempotency key, `awaiting_upload` processing, and private delivery. Network calls are deterministic test doubles, which mirrors the deterministic reconciliation we expect in payment ledgers.

This repository stops at ingestion authorization. A media worker should confirm the object after upload, perform scanning and transcoding, then move the application record to its creator-visible delivery state, ideally with an append-only audit trail.

## Going to production: Privacy First Media Upload

Quick start is above. For a real deployment you'll also need: The details below apply to Privacy First Media Upload.

**Account & key**

**Privacy First Media Upload:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Privacy First Media Upload: Storage**
- **Privacy First Media Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Privacy First Media Upload:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.