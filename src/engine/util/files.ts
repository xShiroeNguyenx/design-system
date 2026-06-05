/**
 * Generated-file helpers shared by scaffold + demo. Generation is pure (returns
 * file contents); writing to disk is a separate, explicit step so generation
 * stays testable without a filesystem.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export interface GeneratedFile {
  /** Path relative to the output directory. */
  path: string;
  content: string;
  /** If true, never overwrite an existing file (e.g. CLAUDE.md, config). */
  preserveExisting?: boolean;
}

export interface WriteResult {
  written: string[];
  skipped: string[];
}

/** Write generated files under `outDir`, honoring `preserveExisting`. */
export function writeFiles(outDir: string, files: GeneratedFile[]): WriteResult {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const full = join(outDir, file.path);
    if (file.preserveExisting && existsSync(full)) {
      skipped.push(file.path);
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content, "utf8");
    written.push(file.path);
  }
  return { written, skipped };
}
