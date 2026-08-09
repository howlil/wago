import { app } from "./app.js";
import { initializeWhatsApp } from "./whatsapp.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  await initializeWhatsApp();

  app.listen(port, host, () => {
    console.log(`Backend listening on http://${host}:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
