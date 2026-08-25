import { type Response, Router } from "express";
import { requireAuthenticatedRequest } from "../../http/middleware/auth.js";
import { optionalHttpString } from "../../http/validation.js";
import { listAudit } from "./query.js";
import type { ActivityCategory, ActivityLevel, AuditSource } from "./store.js";

export const activityRouter = Router();

const AUDIT_SOURCES = new Set<AuditSource>(["wago", "baileys"]);
const AUDIT_CATEGORIES = new Set<ActivityCategory>(["system", "security", "connection", "recipient", "messaging"]);
const AUDIT_LEVELS = new Set<ActivityLevel>(["info", "success", "warning", "error"]);

function invalidFilterResponse(res: Response) {
  return res.status(400).json({
    success: false,
    error: "INVALID_AUDIT_FILTER",
    message: "Audit filter is invalid",
  });
}

activityRouter.get("/", requireAuthenticatedRequest, async (req, res, next) => {
  const rawSource = req.query.source;
  const rawCategory = req.query.category;
  const rawLevel = req.query.level;
  const source = optionalHttpString(rawSource);
  const category = optionalHttpString(rawCategory);
  const level = optionalHttpString(rawLevel);

  if (
    (rawSource !== undefined && (!source || !AUDIT_SOURCES.has(source as AuditSource))) ||
    (rawCategory !== undefined && (!category || !AUDIT_CATEGORIES.has(category as ActivityCategory))) ||
    (rawLevel !== undefined && (!level || !AUDIT_LEVELS.has(level as ActivityLevel)))
  ) {
    return invalidFilterResponse(res);
  }

  const requestedLimit = Number(optionalHttpString(req.query.limit) ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  const before = optionalHttpString(req.query.before);
  const q = optionalHttpString(req.query.q);

  try {
    const page = await listAudit({
      limit,
      before,
      source: source as AuditSource | undefined,
      category: category as ActivityCategory | undefined,
      level: level as ActivityLevel | undefined,
      q,
    });

    return res.json({
      success: true,
      events: page.events,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    });
  } catch (error) {
    return next(error);
  }
});
