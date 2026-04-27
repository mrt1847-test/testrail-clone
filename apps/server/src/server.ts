import { env } from "./config/env.js";
import { buildApp } from "./app.js";

const app = buildApp();
app.listen({ port: env.port, host: "0.0.0.0" }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${env.port}`);
});
