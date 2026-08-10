import { type Response, Router } from "express";
import { listAudit } from "../activity/query.js";
import type { ActivityCategory, ActivityLevel, AuditSource } from "../activity/store.js";
import { requireApiKey } from "../middleware/auth.js";

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

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

activityRouter.get("/", requireApiKey, async (req, res, next) => {
  const rawSource = req.query.source;
  const rawCategory = req.query.category;
  const rawLevel = req.query.level;
  const source = queryString(rawSource);
  const category = queryString(rawCategory);
  const level = queryString(rawLevel);

  if (
    (rawSource !== undefined && (!source || !AUDIT_SOURCES.has(source as AuditSource))) ||
    (rawCategory !== undefined && (!category || !AUDIT_CATEGORIES.has(category as ActivityCategory))) ||
    (rawLevel !== undefined && (!level || !AUDIT_LEVELS.has(level as ActivityLevel)))
  ) {
    return invalidFilterResponse(res);
  }

  const requestedLimit = Number(queryString(req.query.limit) ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  const before = queryString(req.query.before);
  const q = queryString(req.query.q);

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
    if (error instanceof Error && error.name === "INVALID_AUDIT_CURSOR") {
      return res.status(400).json({
        success: false,
        error: "INVALID_AUDIT_CURSOR",
        message: "Audit cursor is invalid",
      });
    }

    return next(error);
  }
});
