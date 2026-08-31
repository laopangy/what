import { getActiveAiConfig } from "../config.js";
import { getAllTools, executeTool } from "../tools/toolRegistry.js";
import type {
  ChatMessage,
  ChatResponse,
  DeepSeekMessage,
  DeepSeekContentBlock,
  DeepSeekResponse,
  ToolCall,
} from "../types/chat.js";

const GENERAL_SYSTEM_PROMPT = `你是阿潘阿潘潘工具栈中的通用 AI 助手。你的首要职责是理解并直接回答用户当前的问题，也可以在用户需要时通过工具操控应用模块。

对话边界（必须遵守）：
- 只围绕用户当前的问题作答，不要因为你拥有某项工具，就主动把无关话题引向该工具或模块。
- 只有用户明确提出音乐需求，或当前消息明显是在延续上一轮音乐操作时，才可以提及音乐、推荐歌曲或调用音乐工具。
- 对数学、知识问答、写作、闲聊等非音乐请求，像通用助手一样直接回答；不要在结尾询问用户是否想听歌，也不要附加音乐相关建议。
- 回答完成后不要机械地追加“还需要什么帮助”之类与当前问题无关的引导。

请用中文回复，语气自然友好。`;

const MUSIC_SYSTEM_PROMPT = `当前请求可以按需调用音乐模块（网易云音乐控制）。

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
- 如果用户明确要求登录（比如"帮我登录"、"登录网易云"），调用 get_login_qr 工具。`;

const MUSIC_INTENT_PATTERN = /音乐|歌曲|歌单|歌手|专辑|歌词|网易云|播放|暂停|继续播放|停止播放|下一首|上一首|切歌|音量|队列|单曲|点歌|听歌|想听|好听/;
const MUSIC_FOLLOW_UP_PATTERN = /^(?:第?[一二三四五六七八九十\d]+个|这(?:个|首)|那(?:个|首)|换一个|换一首|就它|就这首|可以|好的?|是的|不是|重试|再试一次)[。！!？?]?$/;

export function shouldEnableMusicTools(messages: ChatMessage[]): boolean {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) return false;

  const currentMessage = messages[lastUserIndex].content.trim();
  if (MUSIC_INTENT_PATTERN.test(currentMessage)) return true;
  if (!MUSIC_FOLLOW_UP_PATTERN.test(currentMessage)) return false;

  return messages
    .slice(Math.max(0, lastUserIndex - 3), lastUserIndex)
    .some((message) => MUSIC_INTENT_PATTERN.test(message.content));
}

const MAX_LOOPS = 5;

async function callDeepSeek(
  messages: DeepSeekMessage[],
  tools: unknown[],
  systemPrompt: string,
): Promise<DeepSeekResponse> {
  const active = getActiveAiConfig();
  const url = `${active.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const body: Record<string, unknown> = {
    model: active.model,
    max_tokens: 4096,
    system: systemPrompt,
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
      "x-api-key": active.apiKey,
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
  const musicEnabled = shouldEnableMusicTools(messages);
  const tools = musicEnabled ? getAllTools() : [];
  const systemPrompt = musicEnabled
    ? `${GENERAL_SYSTEM_PROMPT}\n\n${MUSIC_SYSTEM_PROMPT}`
    : GENERAL_SYSTEM_PROMPT;
  const toolCalls: ToolCall[] = [];

  const deepseekMessages: DeepSeekMessage[] = messages.map(
    (m): DeepSeekMessage => ({
      role: m.role,
      content: m.content,
    })
  );

  for (let i = 0; i < MAX_LOOPS; i++) {
    const response = await callDeepSeek(deepseekMessages, tools, systemPrompt);

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
