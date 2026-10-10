import type { MetadataRoute } from "next";

import {
  listPublicGrades,
  listPublicStandards,
  listPublicTubeDimensionPages,
  listPublicTubeFamilyHubs,
  listPublicTubeSizeHubs,
} from "@/lib/public-knowledge";
import { schoolArticles } from "@/lib/school-articles";
import { listPublicPriceLists } from "@/lib/public-price-lists";
import { finalizePublicSitemap, newestDate } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [standards, grades, dimensions, familyHubs, sizeHubs, priceLists] = await Promise.all([
    listPublicStandards(),
    listPublicGrades(),
    listPublicTubeDimensionPages(),
    listPublicTubeFamilyHubs(),
    listPublicTubeSizeHubs(),
    listPublicPriceLists(),
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
  const priceListsLastModified = newestDate(
    priceLists.map((item) => item.published_at || item.source_date),
  );
  const knowledgeLastModified = newestDate([
    standardsLastModified,
    gradesLastModified,
    tubesLastModified,
    articlesLastModified,
    priceListsLastModified,
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: knowledgeLastModified,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          it: absoluteUrl("/"),
          en: absoluteUrl("/en"),
          "x-default": absoluteUrl("/"),
        },
      },
    },
    {
      url: absoluteUrl("/en"),
      lastModified: knowledgeLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          it: absoluteUrl("/"),
          en: absoluteUrl("/en"),
          "x-default": absoluteUrl("/"),
        },
      },
    },
    {
      url: absoluteUrl("/en/network"),
      changeFrequency: "monthly",
      priority: 0.78,
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
      alternates: {
        languages: {
          it: absoluteUrl("/knowledge"),
          en: absoluteUrl("/en/knowledge"),
        },
      },
    },
    {
      url: absoluteUrl("/en/knowledge"),
      lastModified: knowledgeLastModified,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: {
          it: absoluteUrl("/knowledge"),
          en: absoluteUrl("/en/knowledge"),
        },
      },
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
      alternates: {
        languages: {
          it: absoluteUrl("/knowledge/tubes"),
          en: absoluteUrl("/en/knowledge/tubes"),
        },
      },
    },
    {
      url: absoluteUrl("/en/knowledge/tubes"),
      lastModified: tubesLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          it: absoluteUrl("/knowledge/tubes"),
          en: absoluteUrl("/en/knowledge/tubes"),
        },
      },
    },
    {
      url: absoluteUrl("/distinta"),
      changeFrequency: "monthly",
      priority: 0.88,
      alternates: {
        languages: {
          it: absoluteUrl("/distinta"),
          en: absoluteUrl("/en/distinta"),
        },
      },
    },
    {
      url: absoluteUrl("/en/distinta"),
      changeFrequency: "monthly",
      priority: 0.86,
      alternates: {
        languages: {
          it: absoluteUrl("/distinta"),
          en: absoluteUrl("/en/distinta"),
        },
      },
    },
    {
      url: absoluteUrl("/listini"),
      lastModified: priceListsLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
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

  const priceListEntries: MetadataRoute.Sitemap = priceLists
    .filter((priceList) => !priceList.is_internal_preview)
    .map((priceList) => ({
      url: absoluteUrl(`/listini/${priceList.version_id}`),
      lastModified: new Date(
        priceList.published_at ||
          (priceList.source_date ? priceList.source_date + "T00:00:00Z" : Date.now()),
      ),
      changeFrequency: "monthly",
      priority: 0.78,
    }));

  return finalizePublicSitemap([
    ...staticEntries,
    ...articleEntries,
    ...standardEntries,
    ...gradeEntries,
    ...familyHubEntries,
    ...sizeHubEntries,
    ...dimensionEntries,
    ...priceListEntries,
  ]);
}
