import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

describe("public product surface", () => {
  it("keeps the API Explorer out of product homepages", async () => {
    const [idHome, enHome, landing] = await Promise.all([
      read("../../pages/id/index.astro"),
      read("../../pages/en/index.astro"),
      read("../LandingPage.astro"),
    ]);

    assert.doesNotMatch(idHome, /ApiExplorer/);
    assert.doesNotMatch(enHome, /ApiExplorer/);
    assert.doesNotMatch(landing, /ApiExplorer/);
  });

  it("keeps one bilingual onboarding composition with the product path visible", async () => {
    const [idHome, enHome, landing] = await Promise.all([
      read("../../pages/id/index.astro"),
      read("../../pages/en/index.astro"),
      read("../LandingPage.astro"),
    ]);

    assert.match(idHome, /<LandingPage lang="id"/);
    assert.match(enHome, /<LandingPage lang="en"/);
    assert.match(landing, /Deploy/);
    assert.match(landing, /Pair/);
    assert.match(landing, /Integrate/);
  });

  it("keeps the landing page technical and free of decorative hero chrome", async () => {
    const landing = await read("../LandingPage.astro");

    assert.doesNotMatch(landing, /blur-3xl/);
    assert.doesNotMatch(landing, /shadow-2xl/);
    assert.doesNotMatch(landing, /rounded-2xl/);
    assert.doesNotMatch(landing, /Wago Control/);
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
