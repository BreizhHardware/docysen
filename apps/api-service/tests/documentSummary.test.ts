import type { FastifyInstance } from "fastify";
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/env.js", () => ({
  env: { S3_BUCKET: "docysen-dev" },
}));

const getPresignedDownloadUrl = vi.fn();
vi.mock("@docysen/utils", () => ({
  getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
}));

const { toDocumentSummary, toDocumentSummaryWithThumbnail } =
  await import("../src/lib/documentSummary.js");

const baseDocument = {
  id: "doc-1",
  title: "Cours de réseaux",
  subject: "Réseaux",
  docType: "cours",
  promoId: "promo-1",
  promo: { label: "ISEN3" },
  semester: "S5",
  fileName: "cours.pdf",
  mimeType: "application/pdf",
  fileSize: 1234,
  status: "approved",
  uploadedById: "user-1",
  uploadedBy: { firstName: "Jean", lastName: "Dupont" },
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
};

describe("toDocumentSummary", () => {
  it("aplatit le document avec la promo et le nom de l'uploader", () => {
    expect(toDocumentSummary(baseDocument as never)).toEqual({
      id: "doc-1",
      title: "Cours de réseaux",
      subject: "Réseaux",
      docType: "cours",
      promoId: "promo-1",
      promoLabel: "ISEN3",
      semester: "S5",
      fileName: "cours.pdf",
      mimeType: "application/pdf",
      fileSize: 1234,
      status: "approved",
      uploadedById: "user-1",
      uploaderName: "Jean Dupont",
      createdAt: "2026-01-15T10:00:00.000Z",
    });
  });
});

describe("toDocumentSummaryWithThumbnail", () => {
  it("retourne thumbnailUrl à null si le document n'a pas de miniature", async () => {
    const fastify = { s3: {} } as unknown as FastifyInstance;
    const result = await toDocumentSummaryWithThumbnail(fastify, {
      ...baseDocument,
      thumbnailKey: null,
    } as never);
    expect(result.thumbnailUrl).toBeNull();
    expect(getPresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("présigne l'URL de miniature quand thumbnailKey est défini", async () => {
    getPresignedDownloadUrl.mockResolvedValueOnce("https://s3.example/thumb.png?sig=abc");
    const fastify = { s3: { fake: true } } as unknown as FastifyInstance;
    const result = await toDocumentSummaryWithThumbnail(fastify, {
      ...baseDocument,
      thumbnailKey: "thumbs/doc-1.png",
    } as never);

    expect(getPresignedDownloadUrl).toHaveBeenCalledWith(fastify.s3, {
      bucket: "docysen-dev",
      key: "thumbs/doc-1.png",
      expiresInSeconds: 300,
    });
    expect(result.thumbnailUrl).toBe("https://s3.example/thumb.png?sig=abc");
    expect(result.id).toBe("doc-1");
  });
});
