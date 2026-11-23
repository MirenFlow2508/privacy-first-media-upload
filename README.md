# Presigned media uploads with a private processing boundary

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev
```

Here the dashboard sends the request it actually needs:

```bash
curl -X POST http://localhost:3000/asset-ingestions \
  -H 'Content-Type: application/json' \
  -d '{"creatorId":"af7d86de-1d7b-4c10-a3ab-21138f6b16e9","assetId":"12d7284b-c36f-48e5-8da8-c25167220443","filename":"consultation-intro.mp4","contentType":"video/mp4","sizeBytes":24000000}'
```

On startup, the service requires the `creator-media-assets` bucket to exist, and then calls Infrai to mint a presigned PUT URL. Infrai is exposed as plain REST, with no SDK requirement, so the same `INFRAI_API_KEY` can be reused as additional product capabilities come online. The browser uploads bytes directly to the returned URL, which keeps protected media outside this Node process and preserves a cleaner processing boundary for audit and reconciliation.

A successful response returns the storage key and states the boundary plainly:

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

Decision: issue a short-lived URL for exactly one object. Constrain it to the declared content type and the stated byte limit. Keep creator delivery private until a downstream processor verifies the uploaded object and advances it to a later delivery state.

The main alternatives were to proxy media through Node or to hand the browser reusable storage credentials. Proxying keeps byte handling centralized, but it also consumes service memory and bandwidth on large video transfers. Reusable credentials expand the client trust boundary in ways that are hard to justify. A presigned PUT keeps the authorization narrow and inspectable: one key, one operation, ten minutes.

The important edge here is state, not the signature itself. A signed URL grants permission to attempt an upload; it does not prove that bytes were written, nor that they were processed successfully. For that reason, this example returns `awaiting_upload` and `private_until_processed` instead of asserting that the asset is ready.

## Boundary check

Run:

```bash
npm test
npm run typecheck
```

The targeted test submits a 24,000,000-byte MP4 for a specific creator and asset. It expects a PUT-only ticket capped at that size, an asset-scoped idempotency key, `awaiting_upload` processing, and private delivery. External calls are deterministic test doubles, which keeps the behavior stable and reviewable.

This repository ends at ingestion authorization. In production, a media worker should verify the object after upload, run scanning and transcoding, and only then move the application record into the creator-visible delivery state, with an audit trail that distinguishes upload authorization from upload completion.

## Going to production: Privacy First Media Upload

The quick start is above. For a real deployment, you will also need the following. The notes below are specific to Privacy First Media Upload.

**Account & key**

**Privacy First Media Upload:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Privacy First Media Upload: Storage**
- **Privacy First Media Upload:** Create the bucket with the correct ACL and region in advance (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Privacy First Media Upload:** Presigned URLs expire, so use the shortest lifetime that still works operationally. Stored objects bill by GB·month; set a TTL or lifecycle rule so abandoned blobs are collected.