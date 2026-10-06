import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith("mysql://"),
  AUTH_SESSION_SECRET: z.string().min(32),
  QR_TOKEN_PEPPER: z.string().min(32),
  IMAGE_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_IMAGE_STORAGE_PATH: z.string().min(1).optional(),
  PUBLIC_IMAGE_BASE_URL: z.string().url().optional(),
});

export class ConfigurationError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing or invalid required environment configuration: ${missing.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

export function getRuntimeEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".") || "environment");
    throw new ConfigurationError([...new Set(missing)]);
  }
  if (parsed.data.IMAGE_STORAGE_DRIVER === "local" && !parsed.data.LOCAL_IMAGE_STORAGE_PATH) {
    throw new ConfigurationError(["LOCAL_IMAGE_STORAGE_PATH"]);
  }
  return parsed.data;
}
