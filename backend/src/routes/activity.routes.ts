import { Router } from "express";
import { listActivity } from "../activity/store.js";
import { requireApiKey } from "../middleware/auth.js";

export const activityRouter = Router();

activityRouter.get("/", requireApiKey, async (req, res) => {
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
  const events = await listActivity(limit);

  return res.json({
    success: true,
    events,
  });
});
