import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const testWorkerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";

export const nodeEnv = process.env.NODE_ENV?.trim() || "development";

export const dataDirectory =
  nodeEnv === "production"
    ? "/app/data"
    : nodeEnv === "test"
      ? resolve(moduleDirectory, "..", "..", "data-test", `${process.pid}-${testWorkerId}`)
      : resolve(moduleDirectory, "..", "..", "data");

export const databaseFile = resolve(dataDirectory, "wago.db");
