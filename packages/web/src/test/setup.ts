import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });

// Testing Library's automatic cleanup doesn't fire reliably under Vitest
// when multiple tests in the same file mount React trees; the rendered
// output from an earlier test bleeds into later queries. Explicit cleanup
// after each test keeps every `render()` call starting from a fresh DOM.
afterEach(() => {
  cleanup();
});
