import { describe, expect, it } from "vitest";
import { nextRevealLength, safeTextEnd } from "./smooth-text";
import { rehypeStreamWords, STREAM_WORD_CLASS, streamWordParts } from "./stream-words";
import type { HastNode } from "./table-utils";

describe("nextRevealLength", () => {
  it("reveals at least one character per frame", () => {
    expect(nextRevealLength(0, 10, 1)).toBe(1);
  });

  it("drains a large backlog faster than a small one", () => {
    const small = nextRevealLength(0, 20, 32) - 0;
    const large = nextRevealLength(0, 2000, 32) - 0;
    expect(large).toBeGreaterThan(small);
  });

  it("never passes the end of the text", () => {
    expect(nextRevealLength(95, 100, 10_000)).toBe(100);
    expect(nextRevealLength(100, 100, 32)).toBe(100);
  });
});

describe("safeTextEnd", () => {
  it("does not split an emoji's surrogate pair", () => {
    const text = "hi 😀 there";
    const emojiStart = text.indexOf("😀");
    expect(safeTextEnd(text, emojiStart + 1)).toBe(emojiStart + 2);
    expect(safeTextEnd(text, emojiStart)).toBe(emojiStart);
  });

  it("clamps to the text", () => {
    expect(safeTextEnd("abc", -1)).toBe(0);
    expect(safeTextEnd("abc", 10)).toBe(3);
  });
});

describe("streamWordParts", () => {
  it("keeps every character, in order", () => {
    for (const text of ["Hello brave new world", "本周完成了流式渲染", "mixed 中文 and English!"]) {
      expect(streamWordParts(text).join("")).toBe(text);
    }
  });

  it("splits CJK text into more than one part", () => {
    expect(streamWordParts("本周完成了流式渲染").length).toBeGreaterThan(1);
  });
});

describe("rehypeStreamWords", () => {
  const text = (value: string): HastNode => ({ type: "text", value });
  const element = (tagName: string, children: HastNode[]): HastNode => ({
    type: "element",
    tagName,
    properties: {},
    children,
  });

  it("wraps prose words and leaves code, links and tables whole", () => {
    const tree: HastNode = {
      type: "root",
      children: [
        element("p", [text("two words"), element("a", [text("a link")])]),
        element("pre", [element("code", [text("const x = 1")])]),
        element("table", [element("tr", [element("td", [text("cell text")])])]),
      ],
    };
    rehypeStreamWords()(tree);
    const [paragraph, pre, table] = tree.children ?? [];
    const words = (paragraph?.children ?? []).filter(
      (child) =>
        child.tagName === "span" &&
        (child.properties?.className as string[] | undefined)?.includes(STREAM_WORD_CLASS),
    );
    expect(words.map((word) => word.children?.[0]?.value)).toEqual(["two", "words"]);
    expect(paragraph?.children?.at(-1)?.tagName).toBe("a");
    expect(paragraph?.children?.at(-1)?.children).toEqual([text("a link")]);
    expect(pre?.children?.[0]?.children).toEqual([text("const x = 1")]);
    expect(table?.children?.[0]?.children?.[0]?.children).toEqual([text("cell text")]);
  });
});
