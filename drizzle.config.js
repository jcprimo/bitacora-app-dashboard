import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/schema.js",
  out: "./server/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/bitacora.db",
  },
});
