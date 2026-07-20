import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("reference fidelity tokens", () => {
  it("exposes the cocoa, gold, canvas, header, and reference card tokens", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/index.css"), "utf8");

    expect(stylesheet).toMatch(/--ref-cocoa:\s*#261e18;/);
    expect(stylesheet).toMatch(/--ref-gold:\s*#c8912f;/);
    expect(stylesheet).toMatch(/--ref-canvas:\s*#f4f0e9;/);
    expect(stylesheet).toMatch(/--ref-header:\s*#fbf8f3;/);
    expect(stylesheet).toMatch(/--ref-card:\s*#ffffff;/);
  });
});
