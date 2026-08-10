import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export const nodeEnv = process.env.NODE_ENV?.trim() || "development";

export const dataDirectory =
  nodeEnv === "production"
    ? "/app/data"
    : nodeEnv === "test"
      ? resolve(moduleDirectory, "..", "..", "data-test")
      : resolve(moduleDirectory, "..", "..", "data");

export const databaseFile =
  nodeEnv === "test" ? resolve(dataDirectory, `wago-${process.pid}.db`) : resolve(dataDirectory, "wago.db");
