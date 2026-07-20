import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import tailwindConfig from "../../../tailwind.config.js";
import { referenceComponentClasses, referenceTokens } from "./referenceTokens.js";

describe("reference fidelity tokens", () => {
  it("exposes every reference semantic token through CSS and Tailwind aliases", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/index.css"), "utf8");
    const css = postcss.parse(stylesheet);
    const declarations = new Map<string, string>();
    css.walkDecls((declaration) => {
      if (declaration.prop.startsWith("--ref-")) {
        declarations.set(declaration.prop, declaration.value);
      }
    });

    expect(referenceTokens).toEqual({
      cocoa: "#261e18",
      gold: "#c8912f",
      goldStrong: "#a86e1f",
      canvas: "#f4f0e9",
      header: "#fbf8f3",
      card: "#ffffff",
      line: "#e7dfd3",
      lineStrong: "#e0d7c8",
      lineSubtle: "#f3ede2",
      tableHead: "#faf7f1",
      goldSoft: "#efe7d7",
      goldWash: "#fdf8ec",
      text: "#261e18",
      muted: "#8a7f73"
    });

    for (const [name, value] of Object.entries(referenceTokens)) {
      const cssName = `--ref-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      expect(declarations.get(cssName)).toBe(value);
    }

    const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, string>;
    for (const name of Object.keys(referenceTokens).map((token) =>
      token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    )) {
      expect(colors[`ref-${name}`]).toBe(`var(--ref-${name})`);
    }

    const selectors = new Set<string>();
    css.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        selectors.add(selector);
      }
    });

    for (const className of referenceComponentClasses) {
      expect(selectors).toContain(`.${className}`);
    }
  });
});
