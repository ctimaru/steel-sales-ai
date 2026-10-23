import unittest
from trust_c2g3d_fail_closed_lint import inspect,parse_report

class LintGateTests(unittest.TestCase):
    def test_error_in_successful_cli_output_is_blocked(self):
        r='''CLI check complete
[
  {"function":"private.example","issues":[{"level":"warning","message":"safe"}]},
  {"function":"public.batch","issues":[{"level":"error","message":"ambiguous"}]}
]
'''
        out=inspect(r)
        self.assertFalse(out["pass"])
        self.assertEqual(out["blocking_functions"],["public.batch"])

    def test_warning_extra_is_not_error(self):
        s='[{"function":"public.x","issues":[{"level":"warning extra"}]}]'
        self.assertTrue(inspect(s)["pass"])

    def test_empty_success_sentinel(self):
        self.assertEqual(parse_report("No schema errors found"),[])

    def test_broken_text_fails_closed(self):
        with self.assertRaises(ValueError):inspect("Supabase CLI completed, no report returned")

    def test_missing_severity_fails_closed(self):
        with self.assertRaises(ValueError):inspect('[{"function":"x","issues":[{"message":"unknown"}]}]')

if __name__=="__main__":
    unittest.main()
