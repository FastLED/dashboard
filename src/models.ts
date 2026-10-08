import * as z from "zod/mini";

const bytes = z.number().check(z.int(), z.nonnegative());
const sha = z.string().check(z.regex(/^[a-f0-9]{40}$/));
const digest = z.string().check(z.regex(/^[a-f0-9]{64}$/));
export const boardSchema = z.enum(["uno", "esp32s3", "esp32dev", "teensy41"]);
export const sketchSchema = z.enum(["blink", "spi", "rainbow"]);
const measurementBase = {
  sketch: sketchSchema,
  board: boardSchema,
  version: z.string().check(z.minLength(1)),
  sha,
  measured_at: z.iso.datetime({ offset: true }),
};
export const successSchema = z.strictObject({
  ...measurementBase,
  status: z.literal("ok"),
  flash: bytes,
  ram: bytes,
  image_flash: bytes,
  attributed_ram: bytes,
  protocol: digest,
  source_digest: digest,
  bloat_report: z
    .string()
    .check(
      z.regex(
        /^data\/reports\/(uno|esp32s3|esp32dev|teensy41)\/[a-f0-9]{40}-[a-f0-9]{12}\.json$/,
      ),
    ),
  fbuild: z.string(),
  serial_symbols: z.array(z.string()),
  toolchain: z.nullable(z.string()),
  defines: z.nullable(z.array(z.string())),
  flags: z.nullable(z.array(z.string())),
  config: z.string(),
  elf_digest: digest,
});
const failureSchema = z.strictObject({
  ...measurementBase,
  status: z.literal("error"),
  flash: z.null(),
  ram: z.null(),
  error: z.string(),
});
export const measurementSchema = z.discriminatedUnion("status", [
  successSchema,
  failureSchema,
]);
export const dashboardSchema = z.strictObject({
  schema: z.literal(2),
  results: z.array(measurementSchema),
  updated_at: z.iso.datetime({ offset: true }),
  versions: z.array(z.string()),
  fbuild: z.string(),
});
const objectReference = z.strictObject({
  archive: z.nullable(z.string()),
  object: z.nullable(z.string()),
});
export const symbolSchema = z.strictObject({
  mangled: z.string(),
  demangled: z.string(),
  address: bytes,
  size: bytes,
  sym_type: z.string(),
  region: z.enum(["flash", "ram"]),
  archive: z.nullable(z.string()),
  object: z.nullable(z.string()),
  output_section: z.nullable(z.string()),
  source: z.string(),
  referenced_by: z.array(objectReference),
  references_to: z.array(z.string()),
  called_by: z.array(z.string()),
});
export const referenceIdentitySchema = z.strictObject({
  name: z.string(),
  address: bytes,
  source: z.string(),
});
const referencePassSchema = z.strictObject({
  status: z.enum(["analyzed", "unavailable", "error"]),
  tool: z.nullable(z.string()),
  reason: z.nullable(z.string()),
});
export const referenceAnalysisSchema = z.strictObject({
  schema: z.literal(1),
  disassembly: referencePassSchema,
  static_data: referencePassSchema,
  object_references: referencePassSchema,
  edges: z.array(
    z.strictObject({
      source: referenceIdentitySchema,
      target: referenceIdentitySchema,
      kind: z.enum(["disassembly", "static_data", "fragment_owner"]),
      offset: z.nullable(bytes),
    }),
  ),
  roots: z.array(
    z.strictObject({ symbol: referenceIdentitySchema, kind: z.string() }),
  ),
  unexplained: z.array(referenceIdentitySchema),
  unresolved: z.array(z.strictObject({ name: z.string(), address: bytes })),
  limitations: z.array(z.string()),
});
export type ReferenceAnalysis = z.infer<typeof referenceAnalysisSchema>;
export type ReferenceIdentity = z.infer<typeof referenceIdentitySchema>;
export const reportSchema = z.strictObject({
  reference_analysis: z.optional(referenceAnalysisSchema),
  elf_path: z.string(),
  map_path: z.nullable(z.string()),
  total_flash: bytes,
  total_ram: bytes,
  image_flash: bytes,
  symbols: z.array(symbolSchema),
  sections: z.array(
    z.strictObject({
      archive: z.nullable(z.string()),
      object: z.nullable(z.string()),
      output_section: z.string(),
      bytes,
    }),
  ),
});
export type Board = z.infer<typeof boardSchema>;
export type Success = z.infer<typeof successSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type BloatReport = z.infer<typeof reportSchema>;

export type Sketch = z.infer<typeof sketchSchema>;
