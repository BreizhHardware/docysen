import { GetObjectCommand } from "@aws-sdk/client-s3";
import { describe, it, expect, beforeAll } from "vitest";

import { createS3Client, getPresignedUploadUrl } from "../src/s3.js";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:3900";
const bucket = process.env.S3_BUCKET ?? "docysen-dev";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? "";

let garageAvailable = false;
beforeAll(async () => {
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(1000) });
    garageAvailable = res.status > 0;
  } catch {
    garageAvailable = false;
  }
});

describe("createS3Client", () => {
  it("force le path-style dès qu'un endpoint custom est fourni (requis par Garage)", () => {
    const client = createS3Client({
      region: "garage",
      endpoint,
      accessKeyId: "x",
      secretAccessKey: "y",
    });
    expect(client.config.forcePathStyle).toBe(true);
  });

  it("ne force pas le path-style sans endpoint (AWS S3 réel)", () => {
    const client = createS3Client({
      region: "eu-west-3",
      accessKeyId: "x",
      secretAccessKey: "y",
    });
    expect(client.config.forcePathStyle).toBeFalsy();
  });
});

describe("getPresignedUploadUrl (intégration Garage)", () => {
  it("génère une URL PUT qui accepte réellement l'upload puis relit le contenu", async () => {
    if (!garageAvailable) {
      // eslint-disable-next-line no-console
      console.warn(
        "Garage indisponible sur %s, test skippé (docker compose up -d garage)",
        endpoint,
      );
      return;
    }

    const client = createS3Client({ region: "garage", endpoint, accessKeyId, secretAccessKey });
    const key = `test/${Date.now()}-s3-utils.txt`;
    const body = "docysen presigned upload test";

    const uploadUrl = await getPresignedUploadUrl(client, {
      bucket,
      key,
      contentType: "text/plain",
      contentLength: body.length,
      expiresInSeconds: 60,
    });

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body,
    });
    expect(putRes.status).toBe(200);

    const getRes = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stored = await getRes.Body?.transformToString();
    expect(stored).toBe(body);
  });
});
