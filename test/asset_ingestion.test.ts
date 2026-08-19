import { afterEach, describe, expect, it, vi } from "vitest";

describe("asset ingestion policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("scopes a PUT ticket to one creator asset and keeps delivery private", async () => {
    process.env.INFRAI_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { name: "creator-media-assets" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { url: "https://uploads.example/signed" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { beginAssetIngestion } = await import("../src/asset_ingestion");

    const ticket = await beginAssetIngestion({
      creatorId: "af7d86de-1d7b-4c10-a3ab-21138f6b16e9",
      assetId: "12d7284b-c36f-48e5-8da8-c25167220443",
      filename: "consultation-intro.mp4",
      contentType: "video/mp4",
      sizeBytes: 24_000_000,
    });

    expect(ticket.upload).toEqual({ method: "PUT", url: "https://uploads.example/signed", expiresInSeconds: 600 });
    expect(ticket.processing.state).toBe("awaiting_upload");
    expect(ticket.delivery.state).toBe("private_until_processed");
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining("/creators/af7d86de-1d7b-4c10-a3ab-21138f6b16e9/assets/12d7284b-c36f-48e5-8da8-c25167220443/consultation-intro.mp4"), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        op: "put",
        expires_seconds: 600,
        content_type: "video/mp4",
        max_bytes: 24_000_000,
        idempotency_key: "asset-upload:12d7284b-c36f-48e5-8da8-c25167220443",
      }),
    }));
  });

  it("continues when the startup bucket already exists", async () => {
    process.env.INFRAI_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        error: { code: "ALREADY_EXISTS", message: "Bucket name already exists" },
      }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { url: "https://uploads.example/signed" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { beginAssetIngestion } = await import("../src/asset_ingestion");

    const ticket = await beginAssetIngestion({
      creatorId: "af7d86de-1d7b-4c10-a3ab-21138f6b16e9",
      assetId: "12d7284b-c36f-48e5-8da8-c25167220443",
      filename: "consultation-intro.mp4",
      contentType: "video/mp4",
      sizeBytes: 24_000_000,
    });

    expect(ticket.upload.url).toBe("https://uploads.example/signed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
