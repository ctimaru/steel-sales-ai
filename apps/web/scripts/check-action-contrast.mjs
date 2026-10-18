import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function contrastIssues(source, file = "unknown") {
  const issues = [];
  // Inspect JSX class strings (including ternary branches) and nearby inline styles.
  const items = source.match(/(?:className\s*=\s*\{?[\s\S]{0,700}?\}?\s*>|className\s*=\s*"[^"]{1,700}")/g) ?? [];
  for (const item of items) {
    const solid = /(?:bg-\[#(?:123b34|123d34|173f35|185247|1a5144|1f6b5a|287d6b)\]|bg-\[var\(--brand-(?:primary|primary-hover|700|800|900)\)\]|bg-(?:green|emerald)-(?:600|700|800|900)|(?:app|platform)-primary|brand-button)/i.test(item);
    const dark = /(?:text-(?:black|slate-900|gray-900|neutral-900)|text-\[#(?:000000|0f1720|123b34|173f35|1a5144|1d2824)\]|text-\[var\(--text-primary\)\])/i.test(item);
    if (solid && dark && !/(?:text-white|text-\[#fff(?:fff)?\]|ui-action-primary)/i.test(item)) {
      issues.push(`${file}: solid-green background paired with dark foreground: ${item.replace(/\s+/g, " ").slice(0, 180)}`);
    }
  }
  return issues;
}

export function addedFilesDiff(diff) {
  const files = [];
  let current = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      const path = line.slice(6);
      current = /\.tsx$/.test(path) && /^apps\/web\/(?:app|components)\//.test(path) ? { path, chunks: [] } : null;
      if (current) files.push(current);
    } else if (current && line.startsWith("+") && !line.startsWith("+++")) {
      current.chunks.push(line.slice(1));
    }
  }
  return files;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const base = process.argv[2];
  if (!base || !/^[a-f0-9]{40}$/.test(base)) {
    process.stderr.write("Usage: node scripts/check-action-contrast.mjs <base_sha>\n");
    process.exit(2);
  }
  const diff = execFileSync("git", ["diff", "--unified=0", `${base}...HEAD`, "--", "apps/web/app", "apps/web/components"], {encoding:"utf8", maxBuffer: 12 * 1024 * 1024});
  const failures = [];
  for (const file of addedFilesDiff(diff)) {
    // Inspect whole file when edited, but report only when suspicious tokens were added.
    const added = file.chunks.join("\n");
    if (!/(?:bg-|primary|brand-button)/.test(added)) continue;
    const content = readFileSync(file.path, "utf8");
    if (contrastIssues(added, file.path).length) failures.push(...contrastIssues(content, file.path));
  }
  if (failures.length) {
    process.stderr.write("UI-SYSTEM2: unsafe solid-green action contrast detected. Use Button/ActionLink with semantic variant.\n" + failures.join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write("UI-SYSTEM2: changed action contrast checks passed.\n");
}
