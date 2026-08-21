import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN ?? "http://localhost:5173";

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY doivent être renseignées.",
  );
  process.exit(1);
}

const client = new S3Client({
  region: "garage",
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [allowedOrigin],
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

console.log(`CORS configuré sur ${bucket} pour l'origine ${allowedOrigin}.`);
