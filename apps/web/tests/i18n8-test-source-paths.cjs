"use strict";
/**
 * Source-contract test compatibility for the I18N8 root-layout split.
 * Legacy tests read app/ file paths directly; the production TypeScript compiler,
 * Next.js routes and Vercel never load this adapter. Paths are remapped only when
 * the original source file does not exist, and the new file must really exist.
 * Do not use in runtime code, production, or live browser tests.
 */
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { syncBuiltinESMExports } = require("node:module");
const root = path.resolve(__dirname, "../app");
const originals = { readFileSync: fs.readFileSync, existsSync: fs.existsSync };
const italianFolders = new Set(["(platform)","(public)","(workspace)","cookies","evidence","forgot-password","investitori","legal","login","onboarding","privacy","register","registration","reset-password","staff","terms","verify-email"]);

function resolveLegacyFile(input) {
  const name = input instanceof URL ? fileURLToPath(input) : typeof input === "string" ? path.resolve(input) : null;
  if (!name || !name.startsWith(root + path.sep) || originals.existsSync(name)) return null;
  const relative = path.relative(root, name).replaceAll(path.sep, "/");
  const pieces = relative.split("/");
  let mapped;
  if (relative === "layout.tsx") mapped = "site-document.tsx";
  else if (relative === "page.tsx") mapped = "(italian)/page.tsx";
  else if (pieces[0] === "en") mapped = "(english)/" + relative;
  else if (italianFolders.has(pieces[0])) mapped = "(italian)/" + relative;
  if (!mapped) return null;
  const target = path.join(root, ...mapped.split("/"));
  return originals.existsSync(target) ? target : null;
}

fs.readFileSync = function sourceContractReadFile(input, ...args) {
  const mapped = resolveLegacyFile(input);
  return originals.readFileSync.call(this, mapped || input, ...args);
};
syncBuiltinESMExports();
