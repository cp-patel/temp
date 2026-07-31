/**
 * Loads the browser curriculum files in a Node context.
 *
 * The content files are plain classic scripts that attach to `window`, so any
 * tooling that wants to read them (validation, stats, tests, the backend's
 * ingestion step) can do so without a build step or a duplicate copy of the
 * data. This module is the single place that shim lives.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..", "..");

const CONTENT_DIR = join(ROOT, "js", "content");

/* Loaded after the phase files because they read the populated registry at load
   time, not only inside functions. Kept in the same order index.html uses — a
   loader that disagrees with the page is a class of bug no test would catch,
   because both would be internally consistent. */
const LAST = ["tracks.js", "competencies.js"];

/** Content files in the order index.html loads them. */
export function contentFiles() {
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".js"));
  // meta.js first (it creates the registry), then phase files in name order.
  return [
    "meta.js",
    ...files.filter((f) => f !== "meta.js" && LAST.indexOf(f) === -1).sort(),
    ...LAST.filter((f) => files.includes(f)),
  ].map((f) => join(CONTENT_DIR, f));
}

/**
 * Evaluate the curriculum content files and return the populated registry.
 * Throws with the offending filename if a file fails to parse or run.
 */
export function loadCurriculum() {
  const sandbox = {
    console,
    Curriculum: undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  for (const file of contentFiles()) {
    const src = readFileSync(file, "utf8");
    try {
      new vm.Script(src, { filename: file }).runInContext(context);
    } catch (err) {
      err.message = `${file}: ${err.message}`;
      throw err;
    }
  }

  if (!sandbox.Curriculum) {
    throw new Error("content files did not create a Curriculum registry");
  }
  return sandbox.Curriculum;
}

/** Load a UI/core module the same way (for testing pure helpers). */
export function loadModule(relPath, extraGlobals = {}) {
  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    localStorage: makeMemoryStorage(),
    navigator: {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout,
    clearTimeout,
    Blob: class {
      constructor(parts) {
        this.size = parts.join("").length;
      }
    },
    ...extraGlobals,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  const file = join(ROOT, relPath);
  new vm.Script(readFileSync(file, "utf8"), { filename: file }).runInContext(
    context
  );
  return sandbox;
}

export function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
