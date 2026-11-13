import type { ConnectorTool } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import {
  agentToolDefinitions,
  connectorStepNames,
  describeToolActivity,
  redactAskUserDetailInMessage,
  STATUS_LINE,
} from "./pi-runtime-tools.js";

describe("connector tool labels", () => {
  const search: ConnectorTool = {
    name: "VENDOR_SEARCH_TOOLS",
    label: "Finding tools",
    description: "",
    inputSchema: {},
  };
  const batch: ConnectorTool = {
    name: "VENDOR_MULTI_EXECUTE",
    label: "Running tools",
    description: "",
    inputSchema: {},
    batch: { items: "tools", action: "tool_slug", arguments: "arguments" },
  };
  const tools = new Map([search, batch].map((tool) => [tool.name, tool]));
  const args = { tools: [{ tool_slug: "POSTIZ_LIST_POSTS", arguments: {} }] };

  it("finds a tool under the name the model calls it", () => {
    const renamed: ConnectorTool = { ...search, name: "VENDOR SEARCH" };
    const byAgentName = agentToolDefinitions([renamed]);
    expect(describeToolActivity("VENDOR_SEARCH", {}, (name) => byAgentName.get(name))).toBe(
      "Finding tools",
    );
  });

  it("shows a label or the actions a batch runs instead of the model's tool name", () => {
    expect(describeToolActivity(search.name, { queries: [] }, (name) => tools.get(name))).toBe(
      "Finding tools",
    );
    expect(describeToolActivity(batch.name, args, (name) => tools.get(name))).toBe(
      "Using Postiz list posts",
    );
    expect(connectorStepNames(search, {})).toEqual(["Finding tools"]);
    expect(connectorStepNames(batch, args)).toEqual(["Postiz list posts"]);
    expect(connectorStepNames(batch, {})).toEqual(["Running tools"]);
    const many = { tools: ["A", "B", "C", "D"].map((tool_slug) => ({ tool_slug })) };
    expect(connectorStepNames(batch, many)).toEqual(["Running tools"]);
    const partial = { tools: [{ tool_slug: "POSTIZ_LIST_POSTS" }, {}] };
    expect(connectorStepNames(batch, partial)).toEqual(["Running tools"]);
    const odd = { tools: [{ tool_slug: "list posts --token=abc" }] };
    expect(connectorStepNames(batch, odd)).toEqual(["Running tools"]);
    expect(describeToolActivity(batch.name, odd, (name) => tools.get(name))).toBe("Running tools");
    expect(connectorStepNames(undefined, {})).toEqual([]);
  });
});

describe("describeToolActivity", () => {
  it("uses the model's task description for any tool, including deferred calls", () => {
    for (const name of ["shell", "mcp__calendar__list_events", "destination_write", "use_tool"]) {
      expect(describeToolActivity(name, { [STATUS_LINE]: "查询当地天气", command: "curl …" })).toBe(
        "查询当地天气",
      );
    }
    expect(
      describeToolActivity("use_tool", {
        name: "render_plot",
        arguments: { [STATUS_LINE]: "整理销售趋势" },
      }),
    ).toBe("整理销售趋势");
  });

  it("falls back to readable actions without commands or paths", () => {
    expect(describeToolActivity("shell", { command: "pnpm test --filter web" })).toBe(
      "Working on your request",
    );
    expect(describeToolActivity("read_file", { path: "notes/plan.md" })).toBe("Reading a file");
    expect(describeToolActivity("write_file", { path: "out.csv", content: "…" })).toBe(
      "Writing a file",
    );
    expect(describeToolActivity("list_fleet", {})).toBe("Checking your bots");
    expect(describeToolActivity("render_plot", { spec: {} })).toBe("Rendering a chart");
    expect(describeToolActivity("save_page", { help: true })).toBe("Preparing a page");
    expect(describeToolActivity("save_page", { title: "Plan", source: "x" })).toBe(
      "Creating a page",
    );
    expect(describeToolActivity("add_mcp_server", { name: "Linear" })).toBe("Connecting an app");
    expect(describeToolActivity("run_subagent", { name: "scout", task: "…" })).toBe(
      "Delegating to helper: scout",
    );
    expect(describeToolActivity("create_space", { name: "Customer support" })).toBe(
      "Creating space: Customer support",
    );
    expect(describeToolActivity("web_search", { query: "rakazo agents" })).toBe(
      "Searching the web: rakazo agents",
    );
    expect(describeToolActivity("web_fetch", { url: "https://example.com" })).toBe(
      "Reading a page",
    );
  });

  it("keeps technical tool names out of fallback labels", () => {
    expect(describeToolActivity("mcp__calendar__list_events", {})).toBe(
      "Working with a connected app",
    );
    expect(describeToolActivity("destination_write", undefined)).toBe("Working on your request");
    expect(describeToolActivity("find_tool", {})).toBe("Preparing the next step");
  });

  it("bounds the status line and collapses whitespace", () => {
    const long = `x${"y".repeat(200)}`;
    const line = describeToolActivity("shell", { [STATUS_LINE]: `a\n\t${long}` });
    expect(line.length).toBeLessThanOrEqual(61);
    expect(line).toContain("…");
    expect(line).not.toContain("\n");
    expect(line.startsWith("a x")).toBe(true);
    expect(describeToolActivity("shell", { [STATUS_LINE]: "  查询\n\t当地天气  " })).toBe(
      "查询 当地天气",
    );
  });

  it("redacts recognizable credentials from model status lines", () => {
    const token = "fake-token";
    const line = describeToolActivity("shell", {
      [STATUS_LINE]: `Checking Bearer ${token} api_key=fake-key`,
    });

    expect(line).toContain("Bearer [redacted]");
    expect(line).toContain("api_key=[redacted]");
    expect(line).not.toContain(token);
    expect(line).not.toContain("fake-key");
  });

  it("does not expose URL arguments in fallback labels", () => {
    const line = describeToolActivity("web_fetch", {
      url: "https://user:secret@cdn.example.test/doc.pdf?X-Amz-Signature=abc123&token=leak#frag",
    });
    expect(line).toBe("Reading a page");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("X-Amz-Signature");
    expect(line).not.toContain("token=");
    expect(line).not.toContain("abc123");
    expect(line).not.toContain("frag");
  });

  it("does not echo secrets from malformed web_fetch URLs", () => {
    const line = describeToolActivity("web_fetch", {
      url: "https://user:secret@[",
    });
    expect(line).toBe("Reading a page");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("user:");
  });

  it.each([undefined, null, 42, {}, "", " \n\t "])(
    "ignores an absent or invalid status (%j)",
    (value) => {
      expect(describeToolActivity("read_file", { [STATUS_LINE]: value })).toBe("Reading a file");
    },
  );

  it("does not interpret a connector's own status_line argument as a working label", () => {
    expect(describeToolActivity("destination_write", { status_line: "Record status" })).toBe(
      "Working on your request",
    );
  });
});

describe("redactAskUserDetailInMessage", () => {
  it("leaves malformed ask_user arguments for argument preparation to reject", () => {
    const content = [
      { type: "toolCall", name: "ask_user", arguments: "detail" },
      { type: "toolCall", name: "ask_user", arguments: 7 },
      { type: "toolCall", name: "use_tool", arguments: { name: "ask_user", arguments: "detail" } },
      { type: "toolCall", name: "ask_user", arguments: { detail: "token sk-test-1" } },
    ];
    expect(() =>
      redactAskUserDetailInMessage({ role: "assistant", content }, ["sk-test-1"]),
    ).not.toThrow();
    expect(content.map((part) => part.arguments)).toEqual([
      "detail",
      7,
      { name: "ask_user", arguments: "detail" },
      { detail: "token [redacted]" },
    ]);
  });

  it("redacts secrets in ask_user arguments a use_tool wrapper carries as a bare string", () => {
    const content = [
      {
        type: "toolCall",
        name: "use_tool",
        arguments: { name: "ask_user", arguments: "send sk-test-1?" },
      },
    ];
    redactAskUserDetailInMessage({ role: "assistant", content }, ["sk-test-1"]);
    expect(content.map((part) => part.arguments)).toEqual([
      { name: "ask_user", arguments: "send [redacted]?" },
    ]);
  });
});
