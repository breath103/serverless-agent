// Strip Markdown formatting down to searchable plain text.
// First pass — regex-based. Good enough for short-form memory content.
// If FTS recall ever suffers, swap for a real AST parse (e.g. remark).
export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1") // links → label
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // atx headings
    .replace(/^\s{0,3}>\s?/gm, "") // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // bullet lists
    .replace(/^\s{0,3}\d+\.\s+/gm, "") // numbered lists
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/^\s{0,3}[-*_]{3,}\s*$/gm, " ") // hr
    .replace(/\s+/g, " ")
    .trim();
}
