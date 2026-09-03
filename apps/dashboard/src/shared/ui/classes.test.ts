import { describe, expect, it } from "vitest";
import {
  cardBodyClass,
  cardClass,
  dangerButtonClass,
  inputClass,
  keyValueClass,
  keyValueLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
  workspaceModuleClass,
  workspaceModuleHeaderClass,
} from "./classes.js";

const standardControls = [inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass];

describe("shared UI classes", () => {
  it("keeps bounded cards and standard controls on the agreed radius scale", () => {
    expect(cardClass).toContain("rounded-lg");
    for (const control of standardControls) {
      expect(control).toContain("rounded-md");
    }
  });

  it("keeps bounded card padding explicit", () => {
    expect(cardBodyClass).toContain("p-4");
    expect(cardBodyClass).not.toContain("p-3.5");
  });

  it("keeps workspace primitives divider-led instead of card-shaped", () => {
    const workspaceClasses = [
      workspaceModuleClass,
      workspaceModuleHeaderClass,
      keyValueLabelClass,
      keyValueClass,
    ].join(" ");

    expect(workspaceModuleClass).toContain("w-full");
    expect(workspaceModuleHeaderClass).toContain("border-b");
    expect(workspaceClasses).not.toContain("rounded-lg");
    expect(workspaceClasses).not.toContain("shadow");
  });

  it("keeps standard surfaces flat instead of adding decorative elevation or motion", () => {
    const classes = [cardClass, ...standardControls].join(" ");

    expect(classes).not.toContain("shadow");
    expect(classes).not.toContain("translate-y");
    expect(classes).not.toContain("gradient");
  });
});
