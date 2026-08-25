import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../backend/src/infrastructure/database/migrations.ts", import.meta.url), "utf8");
const versions = Array.from(source.matchAll(/\bversion:\s*(\d+),/g), (match) => Number(match[1]));

if (versions.length === 0) {
  throw new Error("No database migration versions were found");
}

for (let index = 0; index < versions.length; index += 1) {
  const expected = index + 1;
  if (versions[index] !== expected) {
    throw new Error(`Migration versions must be contiguous from 1; expected ${expected}, received ${versions[index]}`);
  }
}

process.stdout.write(JSON.stringify(versions));
