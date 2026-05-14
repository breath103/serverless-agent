declare namespace WebSearch {
  interface SearchResult {
    title: string;
    url: string;
    content: string;
    score: number; // Relevance score from 0 to 1, higher is more relevant
  }
  interface ImageSearchResult {
    url: string; // Direct URL to the image
    description?: string; // Description of the image, if available
  }
  interface Skill {
    search(params: {
      query: string;
      maxResults?: number; // default: 10. min: 1, max: 20
      topic?: "general" | "news" | "finance"; // default: "general"
      time?: {
        type: "relative";
        range: "year" | "month" | "week" | "day";
      } | {
        type: "absolute";
        start: string; // YYYY-MM-DD
        end: string; // YYYY-MM-DD
      };
    }): Promise<WebSearch.SearchResult[]>;
    imageSearch(params: {
      query: string;
      maxResults?: number; // default: 5. min: 1, max: 20. Maximum number of images to return
    }): Promise<WebSearch.ImageSearchResult[]>;
  }
}
