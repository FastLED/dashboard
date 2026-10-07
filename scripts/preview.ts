import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../docs/", import.meta.url));
export async function preview() {
  const server = createServer(async (request, response) => {
    try {
      const name = new URL(request.url ?? "/", "http://localhost").pathname;
      const path = resolve(
        root,
        "." + decodeURIComponent(name === "/" ? "/index.html" : name),
      );
      if (!path.startsWith(root)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const content = await readFile(path);
      const type: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
      };
      response.writeHead(200, {
        "Content-Type": type[extname(path)] ?? "application/octet-stream",
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing preview address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      ),
  };
}
