import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  verbose: true,
  strict: true,
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/dot_expenses",
  },
});
