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

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

// Lazy validation — defers Zod parse to first property access rather than
// module load time. Fixes build failures when env vars aren't available
// during Next.js static analysis / page data collection.
let _serverEnv: ServerEnv | null = null;

export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!_serverEnv) {
      _serverEnv = serverSchema.parse(process.env);
    }
    return _serverEnv[prop as keyof ServerEnv];
  },
});

let _clientEnv: ClientEnv | null = null;

export const clientEnv: ClientEnv = new Proxy({} as ClientEnv, {
  get(_target, prop: string) {
    if (!_clientEnv) {
      _clientEnv = clientSchema.parse({
        NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
      });
    }
    return _clientEnv[prop as keyof ClientEnv];
  },
});
