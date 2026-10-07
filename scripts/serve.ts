import { preview } from "./preview.ts";
const server = await preview();
console.log(`Dashboard preview: ${server.url}`);
process.once("SIGINT", () => {
  void server.close();
});
process.once("SIGTERM", () => {
  void server.close();
});
