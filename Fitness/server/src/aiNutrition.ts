import { z } from "zod";
import { nutritionAiConfig } from "./aiConfig.js";

export interface FoodCalculationItem {
  input: string;
  name: string;
  amount: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string;
}

export interface FoodCalculation {
  name: string;
  amount: string;
  grams: number;
  matchedFood: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: FoodCalculationItem[];
  unmatched: string[];
  estimationMethod: "ai";
  note?: string;
}

const aiItemSchema = z.object({
  input: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1).max(60),
  grams: z.number().finite().nonnegative().max(5000),
  calories: z.number().finite().nonnegative().max(10000),
  protein: z.number().finite().nonnegative().max(1000),
  carbs: z.number().finite().nonnegative().max(2000),
  fat: z.number().finite().nonnegative().max(1000),
  note: z.string().trim().max(200).optional(),
});

const aiResultSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.string().trim().min(1).max(40),
  items: z.array(aiItemSchema).min(1).max(20),
  note: z.string().trim().min(1).max(300),
});

const round = (value: number) => Math.round(value * 10) / 10;
const endpoint = (baseUrl: string, suffix: string) => `${baseUrl.replace(/\/$/, "")}/${suffix.replace(/^\//, "")}`;

const systemPrompt = `你是饮食记录中的营养估算器。把用户的一整餐中文描述拆成合理的食物组成，并估算每项实际吃下部分的重量、热量、蛋白质、碳水和脂肪。
规则：
1. 必须理解上下文修饰，例如“两个都去皮”“少饭”“不吃肥肉”“额外加一个”，并落实到对应食物。
2. 餐馆或外卖没有重量时，使用中国常见成品份量；在 note 中简短写明关键份量假设。
3. “去皮”必须降低禽类脂肪和热量，不能仍按带皮数据计算。
4. 套餐应拆出主食、肉类和有明显营养贡献的配菜；不要漏掉用户额外添加的食物。
5. 所有营养数字是该项整份的数值，不是每100克。结果是近似值，不得声称精确。
6. 只返回 JSON，不要 Markdown。JSON 结构：
{"name":"整餐名称","amount":"整餐分量","items":[{"input":"对应原文","name":"食物名称","amount":"分量","grams":数字,"calories":数字,"protein":数字,"carbs":数字,"fat":数字,"note":"估算依据"}],"note":"整餐估算说明"}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 未返回可读取的营养数据");
  return JSON.parse(text.slice(start, end + 1));
}

async function callAi(query: string): Promise<string> {
  if (!nutritionAiConfig.apiKey) throw new Error("AI 营养估算未配置，请先在安装器中保存 AI API Key");
  if (!/^[\x20-\x7e]+$/.test(nutritionAiConfig.apiKey)) {
    throw new Error("AI API Key 格式不正确：当前保存的是中文占位内容，请在安装器中粘贴平台生成的真实 Key");
  }
  const signal = AbortSignal.timeout(60_000);
  const response = await fetch(endpoint(nutritionAiConfig.baseUrl, "v1/messages"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-api-key": nutritionAiConfig.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: Buffer.from(JSON.stringify({
      model: nutritionAiConfig.model,
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: "user", content: `请估算这餐：${query}` }],
    }), "utf-8"),
    signal,
  });
  if (!response.ok) throw new Error(`AI 营养估算请求失败 (${response.status})`);
  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return data.content?.filter((item) => item.type === "text").map((item) => item.text || "").join("").trim() || "";
}

export async function calculateFoodWithAi(query: string): Promise<FoodCalculation> {
  try {
    const parsed = aiResultSchema.parse(extractJson(await callAi(query)));
    const items: FoodCalculationItem[] = parsed.items.map((item) => ({
      ...item,
      grams: round(item.grams),
      calories: Math.round(item.calories),
      protein: round(item.protein),
      carbs: round(item.carbs),
      fat: round(item.fat),
    }));
    return {
      name: parsed.name,
      amount: parsed.amount,
      grams: round(items.reduce((sum, item) => sum + item.grams, 0)),
      matchedFood: items.map((item) => item.name).join(" / "),
      calories: items.reduce((sum, item) => sum + item.calories, 0),
      protein: round(items.reduce((sum, item) => sum + item.protein, 0)),
      carbs: round(items.reduce((sum, item) => sum + item.carbs, 0)),
      fat: round(items.reduce((sum, item) => sum + item.fat, 0)),
      items,
      unmatched: [],
      estimationMethod: "ai",
      note: parsed.note,
    };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new Error("AI 返回的营养数据格式不完整，请重新计算一次");
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("AI 营养估算超时，请稍后重试");
    throw error;
  }
}
