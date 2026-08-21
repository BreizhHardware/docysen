import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3ClientConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export function createS3Client(config: S3ClientConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export interface PresignedUploadRequest {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}

const DEFAULT_EXPIRES_IN_SECONDS = 300;

export async function getPresignedUploadUrl(
  client: S3Client,
  request: PresignedUploadRequest,
): Promise<string> {
  const expiresIn = request.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const command = new PutObjectCommand({
    Bucket: request.bucket,
    Key: request.key,
    ContentType: request.contentType,
    ContentLength: request.contentLength,
  });
  return getSignedUrl(client, command, { expiresIn });
}
