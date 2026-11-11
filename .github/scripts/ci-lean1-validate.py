#!/usr/bin/env python3
"""CI-LEAN1: assert critical PR paths remain covered by scoped CI.

Uses only Python's standard library; runs on every PR inside the protected
'tracked secret guard' job, which the 'required' check already depends on.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


def pull_paths(name):
    lines = (WORKFLOWS / name).read_text().splitlines()
    try:
        start = lines.index("  pull_request:")
    except ValueError as exc:
        raise AssertionError(f"{name}: missing pull_request trigger") from exc
    if lines[start + 1].strip() != "paths:":
        raise AssertionError(f"{name}: no explicit pull_request.paths")
    paths = []
    for line in lines[start + 2:]:
        if line and not line.startswith("      "):
            break
        match = re.match(r'^\s{6}- [\'"]([^\'"]+)[\'"]$', line)
        if match:
            paths.append(match.group(1))
    assert paths, f"{name}: empty pull_request.paths"
    return paths


def glob_regex(pattern):
    """GitHub-like **/ (zero or more dirs), ** (all), * (one segment)."""
    pieces = []
    i = 0
    while i < len(pattern):
        if pattern[i:i + 3] == "**/":
            pieces.append("(?:.*/)?")
            i += 3
        elif pattern[i:i + 2] == "**":
            pieces.append(".*")
            i += 2
        elif pattern[i] == "*":
            pieces.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            pieces.append("[^/]")
            i += 1
        else:
            pieces.append(re.escape(pattern[i]))
            i += 1
    return re.compile("^" + "".join(pieces) + "$")


def routed(patterns, path):
    return any(glob_regex(pattern).fullmatch(path) for pattern in patterns)


def assert_routes(name, should_run=(), should_not_run=()):
    patterns = pull_paths(name)
    for path in should_run:
        assert routed(patterns, path), f"{name} MISSED critical path: {path}"
    for path in should_not_run:
        assert not routed(patterns, path), f"{name} triggers unrelated path: {path}"
    print(f"{name}: {len(should_run)} positive + {len(should_not_run)} negative routing cases OK")


def main():
    flow = "product-flow1-e2e.yml"
    perf = "perf2-1-mobile-acceptance.yml"
    net = "net-ux-filters1-responsive.yml"
    demo = "demotest2-3-chrome-auth.yml"
    assert_routes(flow, (
        "apps/web/components/commercial-ai-native-shell.tsx",
        "apps/web/components/buyer-distinta-builder.tsx",
        "apps/web/lib/access-policy.ts",
        "apps/web/app/(italian)/(workspace)/commercial/page.tsx",
        "apps/web/app/(italian)/(workspace)/rfq-hub/page.tsx",
        "apps/web/app/api/rfq/submit/route.ts",
        "services/worker/app/rfq_ai.py",
        "supabase/migrations/20261111225000_commercial_tenant_acl.sql",
        "supabase/migrations/20261111225000_rfq_dispatch.sql",
    ), (
        "apps/web/components/network-compact-experience.tsx",
        "apps/web/components/school-technical-tutor.tsx",
        "supabase/migrations/20261111103000_net_it_seed1_site_finder.sql",
    ))
    assert_routes(perf, (
        "apps/web/components/school-technical-tutor.tsx",
        "apps/web/components/calculator-region-switch.tsx",
        "apps/web/app/(italian)/(public)/distinta/page.tsx",
        "apps/web/app/globals.css",
    ), (
        "apps/web/app/(italian)/(workspace)/commercial/page.tsx",
        "apps/web/components/network-compact-experience.tsx",
    ))
    assert_routes(net, (
        "apps/web/components/network-compact-experience.tsx",
        "apps/web/app/(italian)/(public)/network/page.tsx",
        "apps/web/lib/network-compact-directory.ts",
    ), ("apps/web/components/commercial-ai-native-shell.tsx",))
    assert_routes(demo, (
        "apps/web/app/login/page.tsx",
        "apps/web/app/(italian)/(workspace)/rfq-hub/page.tsx",
    ), ("apps/web/components/school-technical-tutor.tsx",))
    p0 = (WORKFLOWS / "p0-required-gate.yml").read_text()
    assert "name: required" in p0
    assert "needs: [classify, secret-scan, frontend, worker, supabase]" in p0
    assert "ci-lean1-validate.py" in p0
    for target in [flow, perf]:
        text = (WORKFLOWS / target).read_text()
        assert "  schedule:" in text, f"{target} must retain full nightly testing"
        assert "cancel-in-progress: ${{ github.event_name == 'pull_request' }}" in text
    assert "*) full=true ;;" in (WORKFLOWS / perf).read_text(), "Unknown shared path must fall back to full visual CI"
    print("CI-LEAN1 critical routing/security invariants passed")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"CI-LEAN1 POLICY FAILURE: {exc}", file=sys.stderr)
        sys.exit(1)
