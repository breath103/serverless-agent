import { useCallback, useEffect } from "react";

import { type Block, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { useIsDark } from "@/lib/theme";

import "@blocknote/shadcn/style.css";

// Content is stored as markdown. Only include blocks markdown can round-trip
// (no toggle list) and that don't need upload infra (no image/audio/video/file).
const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    codeBlock: defaultBlockSpecs.codeBlock,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    table: defaultBlockSpecs.table,
  },
});

// Markdown parsers collapse consecutive blank lines — so truly empty paragraph
// blocks vanish on save/reload. Inject a zero-width space into each empty
// paragraph before serializing so the blank line survives the round-trip.
// Stripped again on cleanup so it never leaks into content the user is editing.
const ZWSP = "\u200B";

type AnyBlock = Block<typeof schema.blockSchema, typeof schema.inlineContentSchema, typeof schema.styleSchema>;

function preserveEmptyParagraphs(blocks: AnyBlock[]): AnyBlock[] {
  return blocks.map((block) => {
    if (block.type !== "paragraph" || !Array.isArray(block.content)) return block;
    const text = block.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    if (text === "") {
      return { ...block, content: [{ type: "text", text: ZWSP, styles: {} }] } as AnyBlock;
    }
    if (text.includes(ZWSP)) {
      const cleaned = block.content
        .map((c) => (c.type === "text" ? { ...c, text: c.text.replaceAll(ZWSP, "") } : c))
        .filter((c) => !(c.type === "text" && c.text === ""));
      return { ...block, content: cleaned } as AnyBlock;
    }
    return block;
  });
}

export function MemoryContentEditor({
  initialMarkdown,
  onChange,
}: {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}) {
  const isDark = useIsDark();
  const editor = useCreateBlockNote({ schema });

  // Parse markdown into blocks once on mount. Parent re-keys on memoryId so
  // this remounts (and re-seeds) when switching memories — no external sync needed.
  useEffect(() => {
    const blocks = editor.tryParseMarkdownToBlocks(initialMarkdown);
    if (blocks.length > 0) editor.replaceBlocks(editor.document, blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const handleChange = useCallback(() => {
    const blocks = preserveEmptyParagraphs(editor.document);
    onChange(editor.blocksToMarkdownLossy(blocks));
  }, [editor, onChange]);

  return (
    // eslint-disable-next-line better-tailwindcss/no-unknown-classes -- custom selector defined in global.css for BlockNote editor padding
    <div className="memory-content-editor">
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme={isDark ? "dark" : "light"}
        shadCNComponents={{}}
      />
    </div>
  );
}
