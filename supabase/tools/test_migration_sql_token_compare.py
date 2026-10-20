import unittest

from migration_sql_token_compare import compare_sql, tokenize_sql, validate_manifest


class SqlTokenComparatorTest(unittest.TestCase):
    def test_only_comments_whitespace_removed_including_dollar_function_body(self):
        remote = """-- header
CREATE FUNCTION public.f() RETURNS int AS $function$
BEGIN
  /* first review */ RETURN 1; -- inline
END;
$function$ LANGUAGE plpgsql;"""
        local = """CREATE   FUNCTION public.f() RETURNS int AS $function$
BEGIN RETURN 1; END;
$function$ LANGUAGE plpgsql;"""
        result = compare_sql(remote, local)
        self.assertEqual(result["classification"], "LEXICAL_TOKENS_IDENTICAL_CANDIDATE")
        self.assertFalse(result["safe_for_automatic_repair"])

    def test_security_grants_changed_must_not_be_approved(self):
        remote = "REVOKE EXECUTE ON FUNCTION public.f() FROM anon;"
        local = "GRANT EXECUTE ON FUNCTION public.f() TO anon;"
        result = compare_sql(remote, local)
        self.assertEqual(result["classification"], "EXECUTABLE_TOKEN_DIFFERENCE")
        self.assertGreater(result["positional_token_differences"], 0)

    def test_literal_whitespace_is_significant(self):
        a = "SELECT 'Steel  Tubes', $$A  B$$;"
        b = "SELECT 'Steel Tubes', $$A B$$;"
        self.assertEqual(compare_sql(a, b)["classification"],
                         "EXECUTABLE_TOKEN_DIFFERENCE")

    def test_comment_markers_inside_literal_and_nested_block_comments(self):
        remote = "SELECT '-- not a comment', '/* literal */'; /* outer /* nested */ comment */"
        local = "SELECT '-- not a comment', '/* literal */';"
        self.assertEqual(tokenize_sql(remote), tokenize_sql(local))

    def test_fail_closed_for_unterminated_dollar_or_quote(self):
        for remote in ("SELECT $function$ return 1;", "SELECT 'not closed",
                       "SELECT 1; /* unclosed"):
            self.assertEqual(compare_sql(remote, "SELECT 1;")["classification"],
                             "PARSER_UNCERTAIN")

    def test_manifest_requires_all_59_and_no_repair(self):
        rows = [{"name": f"test_{i}", "local_version": f"20261020{i:06d}",
                 "lexical_category": "LEXICAL_TOKENS_IDENTICAL_CANDIDATE" if i < 38
                                     else "EXECUTABLE_TOKEN_DIFFERENCE"}
                for i in range(59)]
        data = {"contract": "supa-ledger3b-original-sql-token-comparison-v1",
                "results": rows, "auto_repair_authorized": False, "db_writes": 0}
        self.assertEqual(validate_manifest(data)["token_differences"], 21)
        data["auto_repair_authorized"] = True
        with self.assertRaises(ValueError):
            validate_manifest(data)


if __name__ == "__main__":
    unittest.main()
