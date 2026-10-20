from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from ledger3c_current_security_audit import validate


FIXTURE = Path(__file__).resolve().parents[1] / "audits" / "20261020_current_security_catalog_snapshot.json"


class CatalogAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def test_saved_production_snapshot_matches_all_15_functions_and_11_rls_tables(self):
        result = validate(self.data)
        self.assertEqual(result["functions_verified"],15)
        self.assertEqual(result["rls_tables_verified"],11)
        self.assertFalse(result["automatic_migration_repair_allowed"])
        self.assertEqual(len(result["private_legacy_grants_observed"]),2)

    def test_new_anon_execute_to_public_entry_point_fail_closed(self):
        data=deepcopy(self.data)
        f=next(x for x in data["functions"] if x["schema_name"]=="public")
        f["anon_execute"]=True
        with self.assertRaisesRegex(ValueError,"anonymous|anon"):
            validate(data)

    def test_disabling_rls_or_exposing_private_read_is_rejected(self):
        data=deepcopy(self.data)
        t=next(x for x in data["tables"] if x["name"]=="public.network_companies")
        t["rls"]=False
        with self.assertRaises(ValueError):
            validate(data)
        data=deepcopy(self.data)
        t=next(x for x in data["tables"] if x["name"]=="private.netdata1eu_trader_research")
        t["authenticated_select"]=True
        with self.assertRaises(ValueError):
            validate(data)

    def test_private_schema_usage_or_new_anonymous_function_grant_rejected(self):
        data=deepcopy(self.data)
        f=next(x for x in data["functions"] if x["schema_name"]=="private"
               and x["function_name"]=="m8_update_managed_network_company_impl")
        f["anon_schema_usage"]=True
        with self.assertRaises(ValueError):
            validate(data)
        data=deepcopy(self.data)
        f=next(x for x in data["functions"] if x["schema_name"]=="private"
               and x["function_name"]=="m8_update_managed_network_company_impl")
        f["anon_execute"]=True
        with self.assertRaises(ValueError):
            validate(data)

    def test_security_definer_search_path_and_scope_do_not_disappear(self):
        data=deepcopy(self.data)
        f=next(x for x in data["functions"] if x["security_definer"])
        f["runtime_settings"]=[]
        with self.assertRaises(ValueError):
            validate(data)
        data=deepcopy(self.data)
        data["functions"].pop()
        with self.assertRaises(ValueError):
            validate(data)


if __name__=="__main__":
    unittest.main()
