export type SchoolTutorTopic = {
  id: string;
  title: string;
  description: string;
  href: string;
};
/** Curated public article routing only; no synthetic technical answer. */
export function matchSchoolTutorTopic(question: unknown): SchoolTutorTopic | null;
