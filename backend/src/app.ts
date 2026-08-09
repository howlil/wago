import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { messageRouter } from "./routes/message.routes.js";
import { whatsappRouter } from "./routes/whatsapp.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/whatsapp", whatsappRouter);
app.use("/messages", messageRouter);

const jsonErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      success: false,
      error: "INVALID_JSON",
      message: "Request body must be valid JSON"
    });
  }

  return next(error);
};

app.use(jsonErrorHandler);
