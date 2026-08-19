import { createServer } from "node:http";
import { ZodError } from "zod";
import { beginAssetIngestion } from "./asset_ingestion";
import { InfraiError } from "./infrai_storage";

const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/asset-ingestions") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const ticket = await beginAssetIngestion(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(ticket));
  } catch (error) {
    const status = error instanceof ZodError ? 400 : error instanceof InfraiError && error.status < 500 ? error.status : 500;
    const message = error instanceof Error ? error.message : "Request failed";
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }
}).listen(port, () => {
  console.log(`Asset ingestion service listening on http://localhost:${port}`);
});
