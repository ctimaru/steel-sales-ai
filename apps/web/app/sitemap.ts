import type { MetadataRoute } from "next";

import {
  listPublicGrades,
  listPublicStandards,
  listPublicTubeDimensionPages,
  listPublicTubeFamilyHubs,
  listPublicTubeSizeHubs,
} from "@/lib/public-knowledge";
import { schoolArticles } from "@/lib/school-articles";
import { finalizePublicSitemap, newestDate } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [standards, grades, dimensions, familyHubs, sizeHubs] = await Promise.all([
    listPublicStandards(),
    listPublicGrades(),
    listPublicTubeDimensionPages(),
    listPublicTubeFamilyHubs(),
    listPublicTubeSizeHubs(),
  ]);

  const standardsLastModified = newestDate(standards.map((item) => item.last_reviewed_at));
  const gradesLastModified = newestDate(grades.map((item) => item.last_reviewed_at));
  const tubesLastModified = newestDate([
    ...dimensions.map((item) => item.published_at),
    ...familyHubs.map((item) => item.published_at),
    ...sizeHubs.map((item) => item.published_at),
  ]);
  const articlesLastModified = newestDate(
    schoolArticles.map((article) => article.lastReviewedAt),
  );
  const knowledgeLastModified = newestDate([
    standardsLastModified,
    gradesLastModified,
    tubesLastModified,
    articlesLastModified,
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: knowledgeLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/azienda"),
      changeFrequency: "monthly",
      priority: 0.82,
    },
    {
      url: absoluteUrl("/company-data"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/knowledge"),
      lastModified: knowledgeLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/knowledge/articoli"),
      lastModified: articlesLastModified,
      changeFrequency: "weekly",
      priority: 0.84,
    },
    {
      url: absoluteUrl("/knowledge/norme"),
      lastModified: standardsLastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/knowledge/gradi"),
      lastModified: gradesLastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/knowledge/tubes"),
      lastModified: tubesLastModified,
      changeFrequency: "weekly",
      priority: 0.92,
    },
  ];

  const articleEntries: MetadataRoute.Sitemap = schoolArticles.map((article) => ({
    url: absoluteUrl(`/knowledge/articoli/${article.slug}`),
    lastModified: new Date(article.lastReviewedAt + "T00:00:00Z"),
    changeFrequency: "monthly",
    priority: 0.76,
  }));

  const standardEntries: MetadataRoute.Sitemap = standards.map((standard) => ({
    url: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    lastModified: new Date(standard.last_reviewed_at + "T00:00:00Z"),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const gradeEntries: MetadataRoute.Sitemap = grades.map((grade) => ({
    url: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    lastModified: new Date(grade.last_reviewed_at + "T00:00:00Z"),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const familyHubEntries: MetadataRoute.Sitemap = familyHubs.map((hub) => ({
    url: absoluteUrl(`/knowledge/tubes/${hub.family_slug}`),
    lastModified: new Date(hub.published_at),
    changeFrequency: "weekly",
    priority: 0.86,
  }));

  const sizeHubEntries: MetadataRoute.Sitemap = sizeHubs.map((hub) => ({
    url: absoluteUrl(`/knowledge/tubes/${hub.family_slug}/${hub.size_slug}`),
    lastModified: new Date(hub.published_at),
    changeFrequency: "monthly",
    priority: 0.74,
  }));

  const dimensionEntries: MetadataRoute.Sitemap = dimensions.map((dimension) => ({
    url: absoluteUrl(`/knowledge/tubes/${dimension.dimension_slug}`),
    lastModified: new Date(dimension.published_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return finalizePublicSitemap([
    ...staticEntries,
    ...articleEntries,
    ...standardEntries,
    ...gradeEntries,
    ...familyHubEntries,
    ...sizeHubEntries,
    ...dimensionEntries,
  ]);
}
