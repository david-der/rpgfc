// Save slot routes — Story 07.
//
// Save slots are SQLite files in the ./saves/ directory. Each file is
// a complete, self-contained database. The active slot is whichever
// file DATABASE_URL points at.
//
// Endpoints:
//   GET  /api/saves            — list available save slots
//   POST /api/saves            — create a new save slot (copies the current DB)
//   POST /api/saves/load       — switch to a different slot (requires restart)
//   DELETE /api/saves/:name    — delete a save slot

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { readdirSync, copyFileSync, unlinkSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

export interface SavesRouteDeps {
  savesDir: string;
  currentDbPath: string;
}

interface SaveSlot {
  name: string;
  fileName: string;
  active: boolean;
  sizeBytes: number;
}

const createBody = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Name must contain only letters, numbers, spaces, hyphens, and underscores"),
});

const nameParam = z.object({
  name: z.string().min(1),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function listSlots(savesDir: string, currentDbPath: string): SaveSlot[] {
  if (!existsSync(savesDir)) return [];
  const currentFile = basename(currentDbPath);
  const files = readdirSync(savesDir, { withFileTypes: true });
  return files
    .filter((f) => f.isFile() && f.name.endsWith(".db"))
    .map((f) => {
      const { size } = statSync(join(savesDir, f.name));
      return {
        name: f.name.replace(/\.db$/, ""),
        fileName: f.name,
        active: f.name === currentFile,
        sizeBytes: size,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createSavesRoute(deps: SavesRouteDeps) {
  const app = new Hono()
    .get("/", (c) => {
      const slots = listSlots(deps.savesDir, deps.currentDbPath);
      return c.json({ slots });
    })
    .post("/", zValidator("json", createBody), (c) => {
      const { name } = c.req.valid("json");
      const slug = slugify(name);
      if (!slug) {
        return c.json(
          { error: { code: "invalid_name", message: "Name produces an empty slug." } },
          400,
        );
      }
      const fileName = `${slug}.db`;
      const targetPath = join(deps.savesDir, fileName);
      if (existsSync(targetPath)) {
        return c.json(
          { error: { code: "already_exists", message: `Save "${slug}" already exists.` } },
          409,
        );
      }
      copyFileSync(deps.currentDbPath, targetPath);
      return c.json({
        name: slug,
        fileName,
        message: `Save "${slug}" created. Load it by restarting with DATABASE_URL=sqlite:./saves/${fileName}`,
      });
    })
    .delete("/:name", zValidator("param", nameParam), (c) => {
      const { name } = c.req.valid("param");
      const fileName = `${name}.db`;
      const targetPath = join(deps.savesDir, fileName);
      const currentFile = basename(deps.currentDbPath);
      if (fileName === currentFile) {
        return c.json(
          { error: { code: "cannot_delete_active", message: "Cannot delete the active save." } },
          400,
        );
      }
      if (!existsSync(targetPath)) {
        return c.json({ error: { code: "not_found", message: "Save not found." } }, 404);
      }
      unlinkSync(targetPath);
      return c.json({ deleted: name });
    });
  return app;
}
