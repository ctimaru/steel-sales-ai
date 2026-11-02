export type SchoolComparisonRow = { label: string; left: string; right: string };
export type SchoolComparison = {
  id: string;
  title: string;
  subtitle: string;
  left: string;
  right: string;
  rows: SchoolComparisonRow[];
  takeaway: string;
  sources: { label: string; url: string }[];
  links: { label: string; href: string }[];
};
export type SchoolGlossaryEntry = {
  term: string;
  category: string;
  definition: string;
  href: string;
};
export declare const SCHOOL_CONTENT1C_REVIEW_DATE: string;
export declare const SCHOOL_CONTENT1C_PATH: string;
export declare const schoolComparisons: SchoolComparison[];
export declare const schoolGlossary: SchoolGlossaryEntry[];
export declare function getSchoolComparison(id: string): SchoolComparison | null;
export declare function getSchoolGlossaryEntry(term: string): SchoolGlossaryEntry | null;
