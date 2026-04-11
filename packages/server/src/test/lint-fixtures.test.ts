// AC-04, AC-05: the ESLint doctrine rules fire on their deliberate-violation
// fixtures. If this test ever passes on a non-violating file, the rule has
// lost its teeth.
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Walk up to the workspace root: packages/server/src/test → rpgfc/
const workspaceRoot = join(__dirname, "..", "..", "..", "..");

function runEslintExpectingFailure(relativePath: string): {
  stdout: string;
  stderr: string;
} {
  try {
    // --no-ignore forces eslint to lint the fixture files even though the
    // workspace's .eslintrc.cjs `ignorePatterns` excludes the fixtures
    // directory from normal sweeps. --no-eslintrc would also bypass the
    // config; we keep the real config so the rule registration path is
    // exercised end-to-end.
    execSync(`pnpm exec eslint --no-ignore "${relativePath}"`, {
      cwd: workspaceRoot,
      stdio: "pipe",
    });
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      stdout: (e.stdout ?? "").toString(),
      stderr: (e.stderr ?? "").toString(),
    };
  }
  throw new Error(`ESLint unexpectedly passed on ${relativePath}. Did someone disarm the rule?`);
}

describe("ESLint fixture gates — Story 00 AC-04 / AC-05", () => {
  it("AC-04: no-numbers-in-player-facing fires on its fixture", () => {
    const { stdout, stderr } = runEslintExpectingFailure(
      "tests/fixtures/eslint/violations/player-facing-numbers.tsx",
    );
    const combined = stdout + stderr;
    expect(combined).toContain("rpgfc/no-numbers-in-player-facing");
  });

  it("AC-05: no-hidden-in-routes fires on its fixture", () => {
    const { stdout, stderr } = runEslintExpectingFailure(
      "tests/fixtures/eslint/violations/packages/server/src/routes/route-imports-hidden.ts",
    );
    const combined = stdout + stderr;
    expect(combined).toContain("rpgfc/no-hidden-in-routes");
  });
});
