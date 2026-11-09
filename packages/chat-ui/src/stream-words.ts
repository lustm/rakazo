import type { HastNode } from "./table-utils";

/** Class on each word of the block that is still streaming; the stylesheet fades it in. */
export const STREAM_WORD_CLASS = "rk-stream-word";

/**
 * Elements whose text is read as text by their renderer (code copy and highlighting, link labels
 * and favicons, table extraction), so their content is never split into spans.
 */
const KEEP_WHOLE = new Set(["pre", "code", "a", "table", "img", "svg", "math"]);

type Segmenter = { segment(text: string): Iterable<{ segment: string }> };

let segmenter: Segmenter | null | undefined;

function wordSegmenter(): Segmenter | null {
  if (segmenter !== undefined) return segmenter;
  try {
    const Ctor = (
      Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => Segmenter }
    ).Segmenter;
    segmenter = Ctor ? new Ctor(undefined, { granularity: "word" }) : null;
  } catch {
    segmenter = null;
  }
  return segmenter;
}

/**
 * Words and the whitespace between them. CJK text has no spaces, so it is split with
 * Intl.Segmenter into words; without it, into single characters for CJK and on spaces otherwise.
 */
export function streamWordParts(text: string): string[] {
  const words = wordSegmenter();
  if (words) return Array.from(words.segment(text), (part) => part.segment);
  return text.match(/\s+|[　-鿿가-힯＀-￯]|[^\s　-鿿가-힯＀-￯]+/g) ?? [];
}

function wrapText(value: string): HastNode[] {
  return streamWordParts(value).map((part) =>
    /^\s+$/.test(part)
      ? { type: "text", value: part }
      : {
          type: "element",
          tagName: "span",
          properties: { className: [STREAM_WORD_CLASS] },
          children: [{ type: "text", value: part }],
        },
  );
}

/**
 * Rehype plugin for the block that is still streaming: wraps each word in a span so new words
 * can fade in. Spans keep their position-based React keys as text grows, so a word that is already
 * on screen keeps its DOM node and does not animate again.
 */
export function rehypeStreamWords() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text" && child.value) return wrapText(child.value);
        if (child.type === "element" && child.tagName && KEEP_WHOLE.has(child.tagName)) {
          return [child];
        }
        walk(child);
        return [child];
      });
    };
    walk(tree);
  };
}
