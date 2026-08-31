import { Router } from "express";
import { requireAuthenticatedRequest } from "../../http/middleware/auth.js";
import { collectOperationalMetrics, renderOperationalMetrics } from "./metrics.js";

export const metricsRouter = Router();

metricsRouter.get("/", requireAuthenticatedRequest, (_req, res) => {
  res.type("text/plain; version=0.0.4; charset=utf-8");
  return res.send(renderOperationalMetrics(collectOperationalMetrics()));
});
