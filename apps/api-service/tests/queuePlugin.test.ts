import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/env.js", () => ({
  env: { REDIS_URL: "redis://test:6379" },
}));

const indexDocument = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/lib/search.js", () => ({
  indexDocument: (...args: unknown[]) => indexDocument(...args),
}));

type Handlers = Record<string, (...args: never[]) => unknown>;

class MockQueue {
  name: string;
  add = vi.fn();
  getJob = vi.fn();
  close = vi.fn().mockResolvedValue(undefined);
  constructor(name: string) {
    this.name = name;
    queueInstances[name] = this;
  }
}

class MockQueueEvents {
  name: string;
  handlers: Handlers = {};
  on = vi.fn((event: string, cb: (...args: never[]) => unknown) => {
    this.handlers[event] = cb;
  });
  close = vi.fn().mockResolvedValue(undefined);
  constructor(name: string) {
    this.name = name;
    queueEventsInstances[name] = this;
  }
}

const queueInstances: Record<string, MockQueue> = {};
const queueEventsInstances: Record<string, MockQueueEvents> = {};

vi.mock("bullmq", () => ({
  Queue: vi.fn(function (name: string) {
    return new MockQueue(name);
  }),
  QueueEvents: vi.fn(function (name: string) {
    return new MockQueueEvents(name);
  }),
}));

const {
  default: queuePlugin,
  THUMBNAILS_QUEUE,
  PROCESSING_QUEUE,
  TAGGING_QUEUE,
  NOTIFICATIONS_QUEUE,
} = await import("../src/plugins/queue.js");

async function setup() {
  const decorate = vi.fn();
  const hooks: Record<string, () => Promise<void>> = {};
  const addHook = vi.fn((name: string, fn: () => Promise<void>) => {
    hooks[name] = fn;
  });
  const log = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  const prisma = {
    document: { update: vi.fn(), findUnique: vi.fn() },
    tag: { upsert: vi.fn() },
    documentTag: { upsert: vi.fn() },
  };
  const fastify = { decorate, addHook, log, prisma } as unknown as FastifyInstance;

  await queuePlugin(fastify);

  return {
    fastify,
    decorate,
    addHook,
    hooks,
    log,
    prisma,
    thumbnails: {
      queue: queueInstances[THUMBNAILS_QUEUE],
      events: queueEventsInstances[THUMBNAILS_QUEUE],
    },
    processing: {
      queue: queueInstances[PROCESSING_QUEUE],
      events: queueEventsInstances[PROCESSING_QUEUE],
    },
    tagging: { queue: queueInstances[TAGGING_QUEUE], events: queueEventsInstances[TAGGING_QUEUE] },
    notifications: { queue: queueInstances[NOTIFICATIONS_QUEUE] },
  };
}

beforeEach(() => {
  indexDocument.mockClear();
});

describe("queuePlugin - décoration et fermeture", () => {
  it("décore fastify avec les 4 queues", async () => {
    const { decorate, thumbnails, processing, tagging, notifications } = await setup();

    expect(decorate).toHaveBeenCalledWith("thumbnailsQueue", thumbnails.queue);
    expect(decorate).toHaveBeenCalledWith("processingQueue", processing.queue);
    expect(decorate).toHaveBeenCalledWith("taggingQueue", tagging.queue);
    expect(decorate).toHaveBeenCalledWith("notificationsQueue", notifications.queue);
  });

  it("ferme toutes les queues et listeners à l'arrêt", async () => {
    const { hooks, thumbnails, processing, tagging, notifications } = await setup();

    await hooks.onClose();

    expect(thumbnails.events.close).toHaveBeenCalled();
    expect(thumbnails.queue.close).toHaveBeenCalled();
    expect(processing.events.close).toHaveBeenCalled();
    expect(processing.queue.close).toHaveBeenCalled();
    expect(tagging.events.close).toHaveBeenCalled();
    expect(tagging.queue.close).toHaveBeenCalled();
    expect(notifications.queue.close).toHaveBeenCalled();
  });
});

describe("queuePlugin - queue thumbnails", () => {
  it("persiste thumbnailKey/previewKey quand le job est complété", async () => {
    const { thumbnails, prisma } = await setup();
    thumbnails.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-1", thumbnailKey: "thumb.png", previewKey: null },
    });

    await thumbnails.events.handlers.completed({ jobId: "job-1" });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { thumbnailKey: "thumb.png", previewKey: null },
    });
  });

  it("ne fait rien si le job n'existe plus", async () => {
    const { thumbnails, prisma } = await setup();
    thumbnails.queue.getJob.mockResolvedValue(null);

    await thumbnails.events.handlers.completed({ jobId: "job-missing" });

    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it("logue une erreur si le résultat est invalide", async () => {
    const { thumbnails, prisma, log } = await setup();
    thumbnails.queue.getJob.mockResolvedValue({ returnvalue: { invalid: true } });

    await thumbnails.events.handlers.completed({ jobId: "job-bad" });

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-bad" }),
      "Échec de la persistance du résultat de miniature",
    );
  });

  it("logue une erreur si le job de miniature échoue", async () => {
    const { thumbnails, log } = await setup();

    thumbnails.events.handlers.failed({ jobId: "job-2", failedReason: "boom" });

    expect(log.error).toHaveBeenCalledWith(
      { jobId: "job-2", failedReason: "boom" },
      "Job de génération de miniature échoué",
    );
  });
});

describe("queuePlugin - queue processing (OCR)", () => {
  it("persiste l'OCR, réindexe et déclenche le tagging si déjà approuvé", async () => {
    const { processing, tagging, prisma } = await setup();
    processing.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-1", text: "contenu ocr", supported: true },
    });
    prisma.document.update.mockResolvedValue({
      id: "doc-1",
      status: "approved",
      title: "Titre",
      subject: "Réseaux",
      mimeType: "application/pdf",
      ocrText: "contenu ocr",
      promo: { label: "Promo 2024" },
    });

    await processing.events.handlers.completed({ jobId: "job-3" });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { ocrText: "contenu ocr" },
      include: { promo: { select: { label: true } } },
    });
    expect(indexDocument).toHaveBeenCalledTimes(1);
    expect(tagging.queue.add).toHaveBeenCalledWith("tag-document", {
      documentId: "doc-1",
      title: "Titre",
      subject: "Réseaux",
      mimeType: "application/pdf",
      ocrText: "contenu ocr",
    });
    expect(prisma.tag.upsert).not.toHaveBeenCalled();
  });

  it("stocke null si le texte OCR est vide, sans réindexer ni tagger un document non approuvé", async () => {
    const { processing, tagging, prisma } = await setup();
    processing.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-2", text: "", supported: true },
    });
    prisma.document.update.mockResolvedValue({
      id: "doc-2",
      status: "pending",
      title: "Titre",
      subject: "Réseaux",
      mimeType: "application/pdf",
      ocrText: null,
      promo: { label: "Promo 2024" },
    });

    await processing.events.handlers.completed({ jobId: "job-4" });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-2" },
      data: { ocrText: null },
      include: { promo: { select: { label: true } } },
    });
    expect(indexDocument).not.toHaveBeenCalled();
    expect(tagging.queue.add).not.toHaveBeenCalled();
  });

  it("tague le document en 'non-indexé' si le format n'est pas supporté", async () => {
    const { processing, prisma } = await setup();
    processing.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-3", text: "", supported: false },
    });
    prisma.document.update.mockResolvedValue({
      id: "doc-3",
      status: "pending",
      title: "Titre",
      subject: "Réseaux",
      mimeType: "application/x-unknown",
      ocrText: null,
      promo: { label: "Promo 2024" },
    });
    prisma.tag.upsert.mockResolvedValue({ id: "tag-1", label: "non-indexé" });

    await processing.events.handlers.completed({ jobId: "job-5" });

    expect(prisma.tag.upsert).toHaveBeenCalledWith({
      where: { label: "non-indexé" },
      create: { label: "non-indexé" },
      update: {},
    });
    expect(prisma.documentTag.upsert).toHaveBeenCalledWith({
      where: { documentId_tagId: { documentId: "doc-3", tagId: "tag-1" } },
      create: { documentId: "doc-3", tagId: "tag-1" },
      update: {},
    });
  });

  it("ne fait rien si le job OCR n'existe plus", async () => {
    const { processing, prisma } = await setup();
    processing.queue.getJob.mockResolvedValue(null);

    await processing.events.handlers.completed({ jobId: "job-missing" });

    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it("logue une erreur si le résultat OCR est invalide", async () => {
    const { processing, log } = await setup();
    processing.queue.getJob.mockResolvedValue({ returnvalue: { invalid: true } });

    await processing.events.handlers.completed({ jobId: "job-bad" });

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-bad" }),
      "Échec de la persistance du résultat OCR",
    );
  });

  it("logue une erreur si le job OCR échoue", async () => {
    const { processing, log } = await setup();

    processing.events.handlers.failed({ jobId: "job-6", failedReason: "timeout" });

    expect(log.error).toHaveBeenCalledWith(
      { jobId: "job-6", failedReason: "timeout" },
      "Job d'extraction de texte échoué",
    );
  });
});

describe("queuePlugin - queue tagging", () => {
  it("persiste les tags, les associe au document et réindexe si approuvé", async () => {
    const { tagging, prisma } = await setup();
    tagging.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-1", tags: ["réseaux", "cours"] },
    });
    prisma.tag.upsert.mockResolvedValueOnce({ id: "tag-1", label: "réseaux" });
    prisma.tag.upsert.mockResolvedValueOnce({ id: "tag-2", label: "cours" });
    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      status: "approved",
      promo: { label: "Promo 2024" },
    });

    await tagging.events.handlers.completed({ jobId: "job-7" });

    expect(prisma.tag.upsert).toHaveBeenCalledWith({
      where: { label: "réseaux" },
      create: { label: "réseaux" },
      update: {},
    });
    expect(prisma.documentTag.upsert).toHaveBeenCalledWith({
      where: { documentId_tagId: { documentId: "doc-1", tagId: "tag-1" } },
      create: { documentId: "doc-1", tagId: "tag-1" },
      update: {},
    });
    expect(prisma.documentTag.upsert).toHaveBeenCalledWith({
      where: { documentId_tagId: { documentId: "doc-1", tagId: "tag-2" } },
      create: { documentId: "doc-1", tagId: "tag-2" },
      update: {},
    });
    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      include: { promo: { select: { label: true } } },
    });
    expect(indexDocument).toHaveBeenCalledTimes(1);
  });

  it("ne réindexe pas un document qui n'est pas (ou plus) approuvé", async () => {
    const { tagging, prisma } = await setup();
    tagging.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-2", tags: [] },
    });
    prisma.document.findUnique.mockResolvedValue({
      id: "doc-2",
      status: "pending",
      promo: { label: "Promo 2024" },
    });

    await tagging.events.handlers.completed({ jobId: "job-8" });

    expect(indexDocument).not.toHaveBeenCalled();
  });

  it("ne réindexe pas si le document a été supprimé entre-temps", async () => {
    const { tagging, prisma } = await setup();
    tagging.queue.getJob.mockResolvedValue({
      returnvalue: { documentId: "doc-3", tags: [] },
    });
    prisma.document.findUnique.mockResolvedValue(null);

    await tagging.events.handlers.completed({ jobId: "job-9" });

    expect(indexDocument).not.toHaveBeenCalled();
  });

  it("ne fait rien si le job de tagging n'existe plus", async () => {
    const { tagging, prisma } = await setup();
    tagging.queue.getJob.mockResolvedValue(null);

    await tagging.events.handlers.completed({ jobId: "job-missing" });

    expect(prisma.tag.upsert).not.toHaveBeenCalled();
  });

  it("logue une erreur si le résultat de tagging est invalide", async () => {
    const { tagging, log } = await setup();
    tagging.queue.getJob.mockResolvedValue({ returnvalue: { invalid: true } });

    await tagging.events.handlers.completed({ jobId: "job-bad" });

    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-bad" }),
      "Échec de la persistance des tags",
    );
  });

  it("logue une erreur si le job de tagging échoue", async () => {
    const { tagging, log } = await setup();

    tagging.events.handlers.failed({ jobId: "job-10", failedReason: "crash" });

    expect(log.error).toHaveBeenCalledWith(
      { jobId: "job-10", failedReason: "crash" },
      "Job de tagging échoué",
    );
  });
});
