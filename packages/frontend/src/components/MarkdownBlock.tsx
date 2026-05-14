import type { ComponentProps } from "react";
import { memo, useMemo } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import { highlight } from "sugar-high";

import { type ResourceRef, ResourceRow } from "@/routes/app/dashboard/ResourceRow";

import styles from "./MarkdownBlock.module.css";

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const isBlock = className?.startsWith("language-");
  const code = (typeof children === "string" ? children : "").replace(/\n$/, "");
  const highlighted = useMemo(() => isBlock ? highlight(code) : null, [isBlock, code]);

  if (!isBlock) return <code>{children}</code>;
  return <code dangerouslySetInnerHTML={{ __html: highlighted! }} />;
}

function Anchor({ href, children, title }: ComponentProps<"a">) {
  const resource = parseAppHref(href);
  if (resource) {
    return (
      <ResourceRow resource={resource} className="text-accent-1 underline underline-offset-2 hover:opacity-75">
        {children}
      </ResourceRow>
    );
  }
  return <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>;
}

function parseAppHref(href: string | undefined): ResourceRef | null {
  if (!href) return null;
  const match = /^app:\/\/memories\/(.+)$/.exec(href);
  if (!match) return null;
  return { kind: "memory", id: decodeURIComponent(match[1]) };
}

const markdownComponents = { code: CodeBlock, a: Anchor };
const remarkPlugins = [remarkGfm, remarkCjkFriendly];

function urlTransform(url: string, key: string, node: { tagName?: string }): string {
  if (key === "href" && node.tagName === "a" && url.startsWith("app://")) return url;
  return defaultUrlTransform(url);
}

export const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return (
    <div className={styles.markdownContainer}>
      <Markdown remarkPlugins={remarkPlugins} components={markdownComponents} urlTransform={urlTransform}>{text}</Markdown>
    </div>
  );
});
