import type { MetadataRoute } from "next";

import {
  listPublicGrades,
  listPublicStandards,
  listPublicTubeDimensionPages,
  listPublicTubeFamilyHubs,
  listPublicTubeSizeHubs,
} from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [standards, grades, dimensions, familyHubs, sizeHubs] = await Promise.all([
    listPublicStandards(),
    listPublicGrades(),
    listPublicTubeDimensionPages(),
    listPublicTubeFamilyHubs(),
    listPublicTubeSizeHubs(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/knowledge"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/knowledge/norme"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/knowledge/gradi"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/knowledge/tubes"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const standardEntries: MetadataRoute.Sitemap = standards.map((standard) => ({
    url: absoluteUrl(`/knowledge/norme/${standard.slug}`),
    lastModified: new Date(standard.published_at),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const gradeEntries: MetadataRoute.Sitemap = grades.map((grade) => ({
    url: absoluteUrl(`/knowledge/gradi/${grade.slug}`),
    lastModified: new Date(grade.published_at),
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const familyHubEntries: MetadataRoute.Sitemap = familyHubs.map((hub) => ({
    url: absoluteUrl(`/knowledge/tubes/${hub.family_slug}`),
    lastModified: new Date(hub.published_at),
    changeFrequency: "monthly",
    priority: 0.78,
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

  return [
    ...staticEntries,
    ...standardEntries,
    ...gradeEntries,
    ...familyHubEntries,
    ...sizeHubEntries,
    ...dimensionEntries,
  ];
}
