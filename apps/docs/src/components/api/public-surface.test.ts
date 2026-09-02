import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

describe("public product surface", () => {
  it("keeps the API Explorer out of product homepages", async () => {
    const [idHome, enHome] = await Promise.all([
      read("../../pages/id/index.astro"),
      read("../../pages/en/index.astro"),
    ]);

    assert.doesNotMatch(idHome, /ApiExplorer/);
    assert.doesNotMatch(enHome, /ApiExplorer/);
  });

  it("keeps the product onboarding path visible in both languages", async () => {
    const [idHome, enHome] = await Promise.all([
      read("../../pages/id/index.astro"),
      read("../../pages/en/index.astro"),
    ]);

    for (const source of [idHome, enHome]) {
      assert.match(source, /Deploy/);
      assert.match(source, /Pair/);
      assert.match(source, /Integrate/);
    }
  });

  it("does not document removed production env configuration", async () => {
    const [readme, configuration, deployment, api] = await Promise.all([
      read("../../../../../README.md"),
      read("../docs/ConfigurationDoc.astro"),
      read("../docs/DeploymentDoc.astro"),
      read("../docs/ApiDoc.astro"),
    ]);

    const publicDocs = [readme, configuration, deployment, api].join("\n");
    assert.doesNotMatch(publicDocs, /CORS_ORIGIN/);
    assert.doesNotMatch(publicDocs, /VITE_API_BASE_URL/);
    assert.doesNotMatch(publicDocs, /TRUST_PROXY/);
    assert.doesNotMatch(publicDocs, /DEFAULT_COUNTRY_CODE/);
    assert.doesNotMatch(publicDocs, /environment-managed API key/i);
    assert.doesNotMatch(publicDocs, /pre-provisioned machine API key/i);
    assert.doesNotMatch(publicDocs, /API_KEY=.*docker compose/);
    assert.doesNotMatch(readme, /\.env\.production\.example/);
  });
});
