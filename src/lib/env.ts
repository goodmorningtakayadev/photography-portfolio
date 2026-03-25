import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
  ADMIN_PASSWORD_HASH: z.string().startsWith("$2"),
  JWT_SECRET: z.string().min(64),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CDN_URL: z.string().url(),
});

export const serverEnv = serverSchema.parse(process.env);
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
});
