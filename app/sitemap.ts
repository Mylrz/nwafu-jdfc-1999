import type { MetadataRoute } from "next";
import { knownSeasonArchives } from "../lib/public-content";

const siteUrl = "https://nwafu-jdfc-1999.mylrz.chatgpt.site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...knownSeasonArchives.map((season) => ({
      url: `${siteUrl}/seasons/${season.slug}`,
      lastModified: new Date(season.updatedAt),
      changeFrequency: "monthly" as const,
      priority: .78,
    })),
  ];
}
