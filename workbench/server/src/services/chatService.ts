import { config } from "../config.js";
import { getAllTools, executeTool } from "../tools/toolRegistry.js";
import type {
  ChatMessage,
  ChatResponse,
  DeepSeekMessage,
  DeepSeekContentBlock,
  DeepSeekResponse,
  ToolCall,
} from "../types/chat.js";

const SYSTEM_PROMPT = `你是阿潘阿潘潘工具栈的 AI 助手，帮助用户通过语音或文字操控多个模块。

目前可用模块：音乐（网易云音乐控制）。

音乐模块当前支持的操作：
- 搜索：搜索歌曲（search_songs）、搜索歌单（search_playlists）
- 播放控制：播放歌曲、播放歌单、暂停、继续、停止、上一首、下一首
- 进度和音量：跳转播放位置、调节音量
- 队列管理：查看队列、添加歌曲到队列、清空队列
- 播放状态：查看当前播放的歌曲信息
- 登录：获取登录二维码（get_login_qr）

操作提示：
- 当用户想听某首歌时，先用 search_songs 搜索。从搜索结果中找到最匹配的歌曲，然后用 play_song 播放。
- 搜索结果中的 id 字段即为 encryptedId，originalId 字段即为 originalId。播放时同时传入 name（歌曲名）、artist（歌手名，多个用 / 分隔）、duration（时长毫秒），确保播放器正确显示歌曲信息和歌词。
- 搜索无结果时，尝试用不同的关键词组合再次搜索（如缩短关键词、只用歌名或歌手名单独搜索），不要只搜一次就放弃。
- 如果一首歌有多个同名结果（不同歌手），列出前 3-5 个让用户选择，格式如：
  "找到这些版本的《烟圈》：
  1. 功夫胖KUNGFU-PEN — 《全家福》
  2. 万乐体/999PUNKSTA/Zakiya晴子 — 《泡芙小姐 什么是真爱》
  …你想听哪个版本？"
- 播放前确认一下歌手是否匹配用户说的，尽量选最匹配的那个直接播放。

⚠️ 登录处理（重要）：
- 如果工具返回了 needLogin: true 和 qrCodeUrl，说明用户未登录网易云音乐。
- 此时你应该友好地告知用户需要登录，并提供 qrCodeUrl 链接让用户扫码。
- 回复格式示例："要播放音乐需要先登录网易云音乐哦！请用网易云音乐 APP 扫描这个二维码登录：[qrCodeUrl]"
- 用户扫码登录后，可以让他们再次尝试操作。
- 如果用户明确要求登录（比如"帮我登录"、"登录网易云"），调用 get_login_qr 工具。

请用中文回复，语气友好活泼。`;

const MAX_LOOPS = 5;

async function callDeepSeek(
  messages: DeepSeekMessage[],
  tools: unknown[]
): Promise<DeepSeekResponse> {
  const url = `${config.deepseek.baseUrl}/v1/messages`;
  const body: Record<string, unknown> = {
    model: config.deepseek.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  // Buffer encoding avoids ByteString error on Node.js v23+ Windows
  console.log("[chatService] callDeepSeek — building body");
  const bodyStr = JSON.stringify(body);
  console.log(`[chatService] callDeepSeek — body length: ${bodyStr.length}`);
  const bodyBuf = Buffer.from(bodyStr, "utf-8");
  console.log(`[chatService] callDeepSeek — buffer length: ${bodyBuf.length}, sending fetch...`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-api-key": config.deepseek.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: bodyBuf,
  });

  console.log("[chatService] callDeepSeek — response received");

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<DeepSeekResponse>;
}

export async function handleChat(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const tools = getAllTools();
  const toolCalls: ToolCall[] = [];

  const deepseekMessages: DeepSeekMessage[] = messages.map(
    (m): DeepSeekMessage => ({
      role: m.role,
      content: m.content,
    })
  );

  for (let i = 0; i < MAX_LOOPS; i++) {
    const response = await callDeepSeek(deepseekMessages, tools);

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolBlocks = response.content.filter((b) => b.type === "tool_use");

    if (
      response.stop_reason === "end_turn" ||
      response.stop_reason === "max_tokens" ||
      response.stop_reason === "stop_sequence"
    ) {
      return {
        content: textBlocks.map((b) => b.text).join(""),
        toolCalls,
      };
    }

    if (toolBlocks.length > 0) {
      const toolResultBlocks: DeepSeekContentBlock[] = [];
      for (const block of toolBlocks) {
        const result = await executeTool(
          block.name!,
          block.input || {}
        );
        toolCalls.push({
          name: block.name!,
          args: block.input || {},
          result,
        });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      deepseekMessages.push({
        role: "assistant",
        content: response.content,
      });
      deepseekMessages.push({
        role: "user",
        content: toolResultBlocks,
      });
    } else {
      return {
        content: textBlocks.map((b) => b.text).join(""),
        toolCalls,
      };
    }
  }

  return { content: "操作已完成", toolCalls };
}
