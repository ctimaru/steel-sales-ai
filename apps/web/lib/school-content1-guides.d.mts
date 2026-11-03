export type SchoolContent1Guide = {
  heading: string;
  takeaway: string;
  checks: string[];
  editionNote: string;
  compare: { label: string; href: string };
  sources: { label: string; url: string }[];
};

export declare function getSchoolContent1Guide(
  kind: "standard" | "grade",
  slug: string
): SchoolContent1Guide | null;
export declare const SCHOOL_CONTENT1_REVIEW_DATE: string;
