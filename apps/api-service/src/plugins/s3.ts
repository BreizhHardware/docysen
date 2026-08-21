import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { S3Client } from "@aws-sdk/client-s3";
import { createS3Client } from "@docysen/utils";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    s3: S3Client;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const s3 = createS3Client({
    region: env.AWS_REGION,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  });
  fastify.decorate("s3", s3);
  fastify.addHook("onClose", async () => {
    s3.destroy();
  });
});
