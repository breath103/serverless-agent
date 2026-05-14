import { z } from "zod";

import { tavily } from "@tavily/core";

import { defineSkillRuntime } from "./define.js";

const SearchResult = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  score: z.number().describe("Relevance score from 0 to 1, higher is more relevant"),
});

const ImageSearchResult = z.object({
  url: z.string().describe("Direct URL to the image"),
  description: z.string().optional().describe("Description of the image, if available"),
});

export const webSearch = defineSkillRuntime("web-search", {
  instanceDescription: () => "",
  create: () => ({
    client: tavily({ apiKey: process.env.TAVILY_API_KEY }),
  }),

  entities: { SearchResult, ImageSearchResult },

  methods: (m) => ({
    search: m({
      params: z.object({
        query: z.string(),
        maxResults: z.number().min(1).max(20).default(10),
        topic: z.enum(["general", "news", "finance"]).default("general"),
        time: z.discriminatedUnion("type", [
          z.object({ type: z.literal("relative"), range: z.enum(["year", "month", "week", "day"]) }),
          z.object({
            type: z.literal("absolute"),
            start: z.string().describe("YYYY-MM-DD"),
            end: z.string().describe("YYYY-MM-DD"),
          }),
        ]).optional(),
      }),
      returns: z.array(SearchResult),
      handler: async (ctx, params) => {
        const response = await ctx.client.search(params.query, {
          searchDepth: "basic",
          maxResults: params.maxResults,
          topic: params.topic,
          ...params.time?.type === "relative" ? { timeRange: params.time.range } : {},
          ...params.time?.type === "absolute" ? { startDate: params.time.start, endDate: params.time.end } : {},
        });
        return response.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        }));
      },
    }),

    imageSearch: m({
      params: z.object({
        query: z.string(),
        maxResults: z.number().min(1).max(20).default(5).describe("Maximum number of images to return"),
      }),
      returns: z.array(ImageSearchResult),
      handler: async (ctx, params) => {
        const response = await ctx.client.search(params.query, {
          searchDepth: "basic",
          maxResults: params.maxResults,
          includeImages: true,
        });
        return response.images.slice(0, params.maxResults).map((img) => ({
          url: img.url,
          description: img.description,
        }));
      },
    }),
  }),
});
