import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface MediaStorage {
  upload(params: { key: string; body: Buffer; contentType: string }): Promise<{ url: string }>;
}

const REQUIRED_ENV = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_PUBLIC_URL', 'R2_BUCKET'] as const;

function missingEnvVars(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

let client: S3Client | undefined;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

// R2 is S3-API-compatible, so the regular AWS SDK talks to it directly —
// just pointed at R2's endpoint instead of AWS's, with region set to 'auto'
// (R2 doesn't have regions the way S3 does).
export const r2MediaStorage: MediaStorage = {
  async upload({ key, body, contentType }) {
    const missing = missingEnvVars();
    if (missing.length > 0) {
      throw new Error(`R2 storage is not configured — missing env var(s): ${missing.join(', ')}`);
    }

    await getClient().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    const base = process.env.R2_PUBLIC_URL!.replace(/\/+$/, '');
    return { url: `${base}/${key}` };
  },
};
