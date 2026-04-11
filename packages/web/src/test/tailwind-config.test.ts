// AC-16: Tailwind borderRadius is 0 everywhere (except `full`), and boxShadow
// is `none` everywhere. Style Guide §5.1 ("The Zero-Radius Rule") and §5.5
// ("no drop shadows anywhere in the app") are load-bearing visual doctrine —
// this test makes a silent drift impossible.
import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

describe("tailwind.config — Story 00 AC-16", () => {
  it("every borderRadius key except 'full' is '0'", () => {
    const radii = config.theme?.extend?.borderRadius as Record<string, string> | undefined;
    expect(radii).toBeDefined();
    for (const [key, value] of Object.entries(radii as Record<string, string>)) {
      if (key === "full") {
        expect(value).toBe("9999px");
      } else {
        expect(value).toBe("0");
      }
    }
  });

  it("every boxShadow key is 'none'", () => {
    const shadows = config.theme?.extend?.boxShadow as Record<string, string> | undefined;
    expect(shadows).toBeDefined();
    for (const value of Object.values(shadows as Record<string, string>)) {
      expect(value).toBe("none");
    }
  });

  it("parchment / moss / clay / form / result palettes exist with the canonical hex values", () => {
    const colors = config.theme?.extend?.colors as
      | Record<string, Record<string, string>>
      | undefined;
    expect(colors?.parchment?.[50]).toBe("#FAF7F0");
    expect(colors?.parchment?.[900]).toBe("#1A1812");
    expect(colors?.moss?.[500]).toBe("#5C6B33");
    expect(colors?.clay?.[500]).toBe("#865732");
    expect(colors?.form?.["excellent"]).toBe("#5B8C4D");
    expect(colors?.form?.["dreadful"]).toBe("#9C4B2F");
    expect(colors?.result?.["win"]).toBe("#5B8C4D");
    expect(colors?.result?.["draw"]).toBe("#A89878");
    expect(colors?.result?.["loss"]).toBe("#9C4B2F");
  });

  it("content globs point at the package's src tree", () => {
    expect(config.content).toContain("./src/**/*.{ts,tsx,html}");
  });
});
