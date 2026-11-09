// Minimal OpenAI-compatible mock that streams a markdown reply in bursty chunks,
// so the UI's streaming polish can be tested without a real model key.
import http from "node:http";

// Matches RAKAZO_LOCAL_MODELS_URL=http://127.0.0.1:11999/v1 in a local .env.
const PORT = 11999;
const MODEL = "mock-streamer";

const REPLY = `好的，我来整理一下这周的进展。

## 本周完成

- **流式渲染**：回复现在按固定节奏出字，不再一坨一坨地蹦出来
- **滚动跟随**：新内容到来时平滑地跟到底部，往上翻时不会被拽回去
- **入场动效**：新消息轻微上浮淡入

## 一段代码

\`\`\`ts
export function greet(name: string) {
  return \`你好，\${name}！\`;
}
\`\`\`

| 指标 | 改动前 | 改动后 |
| --- | --- | --- |
| 首字延迟 | 380ms | 380ms |
| 观感 | 卡顿 | 丝滑 |

> 小提示：打开系统的「减少动态效果」后，所有动画都会自动关闭。

最后，Lorem ipsum 风格的长段落用来测试换行和滚动：这一段会比较长，模拟模型连续输出大量文字时的表现，看看文字是否稳定、行高是否抖动、光标是否跟随在末尾，以及在窄屏下是否正确换行。`;

function chunks(text) {
  // Irregular bursts: 1–40 chars, mimicking network/batching jitter.
  const out = [];
  let i = 0;
  while (i < text.length) {
    const size =
      Math.random() < 0.2 ? 20 + Math.floor(Math.random() * 20) : 1 + Math.floor(Math.random() * 6);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url?.endsWith("/models")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: [{ id: MODEL, object: "model", owned_by: "mock" }],
        }),
      );
      return;
    }
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const part of req) body += part;
    const request = JSON.parse(body || "{}");
    const id = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    // Chat turns stream; utility calls (titles, summaries) do not and get a short answer.
    const text = request.stream ? REPLY : "本周进展";

    if (!request.stream) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id,
          object: "chat.completion",
          created,
          model: MODEL,
          choices: [
            { index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: text.length,
            total_tokens: 10 + text.length,
          },
        }),
      );
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    send({
      id,
      object: "chat.completion.chunk",
      created,
      model: MODEL,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    });
    await sleep(380);
    for (const piece of chunks(text)) {
      if (res.destroyed) return;
      send({
        id,
        object: "chat.completion.chunk",
        created,
        model: MODEL,
        choices: [{ index: 0, delta: { content: piece }, finish_reason: null }],
      });
      await sleep(Math.random() < 0.15 ? 250 + Math.random() * 300 : 15 + Math.random() * 60);
    }
    send({
      id,
      object: "chat.completion.chunk",
      created,
      model: MODEL,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: text.length, total_tokens: 10 + text.length },
    });
    res.write("data: [DONE]\n\n");
    res.end();
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock LLM on http://127.0.0.1:${PORT}/v1`));
