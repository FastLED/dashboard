import { referenceAuditSchema } from "../src/references.ts";
import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { dashboardSchema, reportSchema } from "../src/models.ts";
await build({
  entryPoints: ["src/app.ts"],
  outfile: "docs/app.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
await mkdir("docs/schemas", { recursive: true });
for (const [name, schema] of [
  ["dashboard", dashboardSchema],
  ["bloat-report", reportSchema],
  ["reference-audit", referenceAuditSchema],
] as const)
  await writeFile(
    `docs/schemas/${name}.schema.json`,
    JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n",
  );
const { readFile } = await import("node:fs/promises");
const hash = createHash("sha256")
  .update(await readFile("docs/app.js"))
  .digest("hex")
  .slice(0, 12);
const index = await readFile("docs/index.html", "utf8");
const styleHash = createHash("sha256")
  .update(await readFile("docs/style.css"))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  "docs/index.html",
  index
    .replace(/<script src="vendor\/chart\.umd\.js"><\/script>\s*/, "")
    .replace(/src="app\.js(?:\?[^"]*)?"/, `src="app.js?v=${hash}"`)
    .replace(
      /href="style\.css(?:\?[^"]*)?"/,
      `href="style.css?v=${styleHash}"`,
    ),
);
