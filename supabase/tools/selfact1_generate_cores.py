"""Generate the SELF1 core-extraction part of the migration from the live definitions.

The staff-only functions are copied verbatim from their latest migration, renamed to
private *_core functions with explicit actor parameters, and the originals become thin
permission-checking wrappers. Every transformation is asserted to apply exactly once.
"""
import pathlib
import re
import sys

MIG = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])


def extract(file: str, name: str) -> str:
    text = (MIG / file).read_text(encoding="utf-8")
    start = text.index(f"create or replace function private.{name}(")
    body_start = text.index("as $function$", start)
    end = text.index("\n$function$;", body_start) + len("\n$function$;")
    return text[start:end]


def sub_once(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{label}: expected {count} occurrence(s) of {old!r}, found {found}")
    return text.replace(old, new)


def wrap_staff_audit(text: str, label: str) -> str:
    """Run sa4_record_registration_action only on the staff path."""
    marker = "  perform private.sa4_record_registration_action("
    if text.count(marker) != 1:
        raise SystemExit(f"{label}: sa4_record_registration_action call not unique")
    start = text.index(marker)
    end = text.index(");", start) + 2
    call = text[start:end]
    indented = "\n".join("  " + line if line else line for line in call.split("\n"))
    return text[:start] + "  if p_mode = 'staff_review' then\n" + indented + "\n  end if;" + text[end:]


# 1. Candidates: pure read, only the permission check goes.
cand = extract("20261001113800_hp4_duplicate_company_resolution.sql", "m7_application_candidates_impl")
cand = sub_once(cand, "function private.m7_application_candidates_impl(", "function private.selfact1_candidates_core(", "cand name")
cand = sub_once(cand, "  perform private.require_platform_permission('registrations.bridge_network');\n", "", "cand perm")

# 2. Network bridge.
bridge = extract("20260928171500_sa4_registration_delegation_cutover.sql", "m7_bridge_registration_impl")
bridge = sub_once(
    bridge,
    "function private.m7_bridge_registration_impl(\n  p_application_id uuid,\n  p_network_company_id uuid default null\n)",
    "function private.selfact1_bridge_core(\n  p_application_id uuid,\n  p_network_company_id uuid,\n  p_actor uuid,\n  p_actor_type text,\n  p_mode text\n)",
    "bridge signature",
)
bridge = sub_once(bridge, "  v_actor := (select auth.uid());\n", "  v_actor := p_actor;\n", "bridge actor")
bridge = sub_once(bridge, "  perform private.require_platform_permission('registrations.bridge_network');\n", "", "bridge perm")
bridge = sub_once(bridge, "private.m7_application_candidates_impl(", "private.selfact1_candidates_core(", "bridge candidates")
bridge = sub_once(bridge, "private.sa4_platform_actor_type()", "p_actor_type", "bridge actor type", count=2)
bridge = wrap_staff_audit(bridge, "bridge audit")

# 3. Activation.
act = extract("20260930090000_hp1_1_registration_gate_integrity.sql", "hp1_1_activate_registration_application_impl")
act = sub_once(
    act,
    "function private.hp1_1_activate_registration_application_impl(\n  p_application_id uuid,\n  p_network_company_id uuid default null\n)",
    "function private.selfact1_activation_core(\n  p_application_id uuid,\n  p_network_company_id uuid,\n  p_actor uuid,\n  p_actor_type text,\n  p_mode text\n)",
    "act signature",
)
act = sub_once(act, "  v_actor_user_id := (select auth.uid());\n", "  v_actor_user_id := p_actor;\n", "act actor")
act = sub_once(
    act,
    "  perform private.require_platform_permission('registrations.activate');\n  perform private.require_platform_permission('registrations.bridge_network');\n",
    "",
    "act perms",
)
act = sub_once(act, "private.m7_application_candidates_impl(", "private.selfact1_candidates_core(", "act candidates")
act = sub_once(act, "private.sa4_platform_actor_type()", "p_actor_type", "act actor type", count=3)
act = sub_once(
    act,
    "private.m7_bridge_registration_impl(\n      p_application_id,\n      p_network_company_id\n    );",
    "private.selfact1_bridge_core(\n      p_application_id,\n      p_network_company_id,\n      p_actor,\n      p_actor_type,\n      p_mode\n    );",
    "act bridge (replay)",
)
act = sub_once(
    act,
    "private.m7_bridge_registration_impl(\n    p_application_id,\n    p_network_company_id\n  );",
    "private.selfact1_bridge_core(\n    p_application_id,\n    p_network_company_id,\n    p_actor,\n    p_actor_type,\n    p_mode\n  );",
    "act bridge (main)",
)
act = wrap_staff_audit(act, "act audit")

for label, fn in (("candidates", cand), ("bridge", bridge), ("activation", act)):
    for forbidden in ("require_platform_permission", "auth.uid()", "sa4_platform_actor_type", "m7_bridge_registration_impl", "m7_application_candidates_impl"):
        if forbidden in fn:
            raise SystemExit(f"{label} core still references {forbidden}")

OUT.write_text(
    "-- Generated by gen_selfact1.py from the latest definitions in\n"
    "-- 20261001113800_hp4_duplicate_company_resolution.sql (m7_application_candidates_impl),\n"
    "-- 20260928171500_sa4_registration_delegation_cutover.sql (m7_bridge_registration_impl),\n"
    "-- 20260930090000_hp1_1_registration_gate_integrity.sql (hp1_1_activate_registration_application_impl).\n"
    "-- Bodies are unchanged except: no permission checks, explicit actor parameters,\n"
    "-- SA4 platform audit only on the staff path.\n\n"
    + cand + "\n\n" + bridge + "\n\n" + act + "\n",
    encoding="utf-8",
)
print("ok", len(cand), len(bridge), len(act))
