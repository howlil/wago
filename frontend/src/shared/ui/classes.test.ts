import { describe, expect, it } from "vitest";
import { cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./classes.js";

const standardControls = [inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass];

describe("shared UI classes", () => {
  it("keeps standard cards and controls on the agreed radius scale", () => {
    expect(cardClass).toContain("rounded-lg");
    for (const control of standardControls) {
      expect(control).toContain("rounded-md");
    }
  });

  it("keeps standard surfaces flat instead of adding decorative elevation or motion", () => {
    const classes = [cardClass, ...standardControls].join(" ");

    expect(classes).not.toContain("shadow");
    expect(classes).not.toContain("translate-y");
    expect(classes).not.toContain("gradient");
  });
});
