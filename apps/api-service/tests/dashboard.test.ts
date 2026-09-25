import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({ env: {} }));

const dashboardRoutes = (await import("../src/routes/dashboard.js")).default;

describe("GET /dashboard/stats", () => {
  it("retourne les compteurs de documents", async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(5);
    const { fastify, handler } = createRouteCapture({ prisma: { document: { count } } });
    await dashboardRoutes(fastify);

    const reply = makeReply();
    await handler("GET", "/dashboard/stats")(makeRequest(), reply);

    expect(count).toHaveBeenCalledTimes(3);
    expect(reply.send).toHaveBeenCalledWith({ total: 42, pending: 7, approvedThisMonth: 5 });
  });
});
