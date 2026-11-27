// NET-CONTACT3 (founder, 27 nov 2026): centralini e caselle di ruolo in automatico.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../../supabase/migrations/20261127140000_net_contact3_switchboards_role_mailboxes.sql", import.meta.url), "utf8");

test("solo fissi, caselle di ruolo sul dominio e provenienza dal sito ufficiale", () => {
  assert.match(sql, /nc\.email IS NULL AND nc\.phone ~ '\^\\\+\(390\[0-9\]\{5,10\}\|3980\[03\]\[0-9\]\{3,7\}\|40\[23\]\[0-9\]\{7,8\}\)\$'/);
  assert.match(sql, /private\.netcontact1_domain_matches\(nc\.email, c\.website_domain\)/);
  assert.match(sql, /a\.field_path = 'netcontact1_public_company_channel'/);
  assert.match(sql, /nc\.source_reference ~ '\^https:\/\/'/);
  assert.doesNotMatch(sql, /\\\+393/, "mobile numbers are never auto-published");
  assert.match(sql, /REVOKE ALL ON FUNCTION private\.net_contact3_auto_review\(integer\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.net_contact2_auto_publish\(integer\) TO service_role;/);
});
