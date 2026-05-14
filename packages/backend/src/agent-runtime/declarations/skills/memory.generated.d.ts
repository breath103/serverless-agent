declare namespace Memory {
  interface Memory {
    id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
  }
  interface MemorySearchMatch {
    id: string;
    title: string;
    rank: number;
  }
  interface Skill {
    search(params: {
      query: string;
      limit?: number;
    }): Promise<Memory.MemorySearchMatch[]>;
    get(params: {
      ids: string[];
    }): Promise<Memory.Memory[]>;
    create(params: {
      title: string;
      content: string;
    }): Promise<Memory.Memory>;
    update(params: {
      id: string;
      title?: string;
      content?: string;
    }): Promise<Memory.Memory>;
  }
}
