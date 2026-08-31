interface FoodNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodItem {
  name: string;
  aliases: string[];
  servingGrams: number;
  servingLabel: string;
  per100g: FoodNutrition;
}

export interface FoodCalculation extends FoodNutrition {
  name: string;
  amount: string;
  grams: number;
  matchedFood: string;
  items: FoodCalculationItem[];
  unmatched: string[];
  estimationMethod?: "local" | "ai";
  note?: string;
}

export interface FoodCalculationItem extends FoodNutrition {
  input: string;
  name: string;
  amount: string;
  grams: number;
  note?: string;
}

export const foodCatalog: FoodItem[] = [
  { name: "皮蛋瘦肉粥", aliases: ["皮蛋粥", "瘦肉粥"], servingGrams: 400, servingLabel: "碗", per100g: { calories: 54, protein: 2.7, carbs: 8.3, fat: 1.1 } },
  { name: "小灌汤包", aliases: ["灌汤包", "小笼包"], servingGrams: 30, servingLabel: "个", per100g: { calories: 220, protein: 8.5, carbs: 28, fat: 8.3 } },
  { name: "鸡蛋瘦肉肠粉", aliases: ["瘦肉肠粉", "鸡蛋肠粉", "肠粉"], servingGrams: 300, servingLabel: "份", per100g: { calories: 150, protein: 6.5, carbs: 22, fat: 4 } },
  { name: "熟米饭", aliases: ["米饭", "白米饭"], servingGrams: 150, servingLabel: "碗", per100g: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 } },
  { name: "鸡胸肉", aliases: ["鸡胸", "鸡肉"], servingGrams: 150, servingLabel: "份", per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { name: "鸡蛋", aliases: ["水煮鸡蛋", "水煮蛋", "煮鸡蛋"], servingGrams: 50, servingLabel: "个", per100g: { calories: 144, protein: 13.3, carbs: 2.8, fat: 8.8 } },
  { name: "牛肉", aliases: ["瘦牛肉", "牛排"], servingGrams: 150, servingLabel: "份", per100g: { calories: 125, protein: 20, carbs: 0, fat: 4.2 } },
  { name: "猪里脊", aliases: ["里脊肉", "瘦猪肉"], servingGrams: 150, servingLabel: "份", per100g: { calories: 143, protein: 20.3, carbs: 0, fat: 6.2 } },
  { name: "三文鱼", aliases: ["鲑鱼"], servingGrams: 150, servingLabel: "份", per100g: { calories: 208, protein: 20.4, carbs: 0, fat: 13.4 } },
  { name: "燕麦片", aliases: ["燕麦", "麦片"], servingGrams: 40, servingLabel: "份", per100g: { calories: 377, protein: 15, carbs: 66, fat: 6.7 } },
  { name: "全脂牛奶", aliases: ["牛奶", "纯牛奶"], servingGrams: 250, servingLabel: "杯", per100g: { calories: 65, protein: 3.3, carbs: 4.9, fat: 3.6 } },
  { name: "无糖豆浆", aliases: ["豆浆"], servingGrams: 250, servingLabel: "杯", per100g: { calories: 31, protein: 3, carbs: 1.2, fat: 1.6 } },
  { name: "香蕉", aliases: [], servingGrams: 100, servingLabel: "根", per100g: { calories: 93, protein: 1.4, carbs: 22, fat: 0.2 } },
  { name: "苹果", aliases: [], servingGrams: 180, servingLabel: "个", per100g: { calories: 53, protein: 0.4, carbs: 13.7, fat: 0.2 } },
  { name: "红薯", aliases: ["地瓜", "番薯"], servingGrams: 200, servingLabel: "个", per100g: { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1 } },
  { name: "熟面条", aliases: ["面条", "面"], servingGrams: 250, servingLabel: "碗", per100g: { calories: 110, protein: 3.2, carbs: 24.2, fat: 0.2 } },
  { name: "馒头", aliases: [], servingGrams: 100, servingLabel: "个", per100g: { calories: 223, protein: 7, carbs: 47, fat: 1.1 } },
  { name: "北豆腐", aliases: ["豆腐"], servingGrams: 150, servingLabel: "份", per100g: { calories: 116, protein: 12.2, carbs: 4.2, fat: 6.2 } },
  { name: "西兰花", aliases: ["花椰菜"], servingGrams: 150, servingLabel: "份", per100g: { calories: 36, protein: 4.1, carbs: 4.3, fat: 0.6 } },
  { name: "花生酱", aliases: [], servingGrams: 15, servingLabel: "勺", per100g: { calories: 600, protein: 25, carbs: 20, fat: 50 } },
  { name: "乳清蛋白粉", aliases: ["蛋白粉", "乳清"], servingGrams: 30, servingLabel: "勺", per100g: { calories: 400, protein: 80, carbs: 7, fat: 6 } },
  { name: "无糖酸奶", aliases: ["酸奶"], servingGrams: 200, servingLabel: "杯", per100g: { calories: 63, protein: 5.2, carbs: 7, fat: 1.6 } },
  { name: "全麦面包", aliases: ["面包", "吐司"], servingGrams: 35, servingLabel: "片", per100g: { calories: 246, protein: 9.9, carbs: 46, fat: 3.4 } },
];

const round = (value: number) => Math.round(value * 10) / 10;

const chineseDigits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function parseCount(value: string): number {
  if (/^\d/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [before, after] = value.split("十");
    return (before ? chineseDigits[before] || 1 : 1) * 10 + (after ? chineseDigits[after] || 0 : 0);
  }
  return chineseDigits[value] || 1;
}

function findFood(normalized: string): FoodItem | undefined {
  return foodCatalog
    .flatMap((food) => [food.name, ...food.aliases].map((alias) => ({ food, alias: alias.toLowerCase() })))
    .filter(({ alias }) => normalized.includes(alias))
    .sort((a, b) => b.alias.length - a.alias.length)[0]?.food;
}

function calculateFromNutritionLabel(input: string): FoodCalculationItem | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, "");
  const energyMatch = normalized.match(/^(.+?)每(?:100|百)(克|g|毫升|ml)[：:,，]?([\d.]+)(kj|千焦|kcal|千卡|大卡)/i);
  if (!energyMatch) return null;
  const consumedMatch = normalized.match(/(?:吃了|食用|摄入|喝了|用了)([\d.]+)(克|g|毫升|ml)/i)
    || normalized.slice(energyMatch[0].length).match(/[，,；;\/]([\d.]+)(克|g|毫升|ml)/i);
  if (!consumedMatch) return null;

  const name = energyMatch[1].replace(/^(外卖|包装|一份)/, "") || "自定义食物";
  const energy = Number(energyMatch[3]);
  const energyUnit = energyMatch[4].toLowerCase();
  const consumed = Number(consumedMatch[1]);
  if (!Number.isFinite(energy) || !Number.isFinite(consumed) || energy < 0 || consumed <= 0) return null;
  const caloriesPer100 = ["kj", "千焦"].includes(energyUnit) ? energy / 4.184 : energy;
  return {
    input: input.trim(), name, amount: `${consumed}${consumedMatch[2]}`, grams: round(consumed),
    calories: Math.round(caloriesPer100 * consumed / 100), protein: 0, carbs: 0, fat: 0,
    note: "仅按能量标签换算；未提供蛋白质、碳水和脂肪",
  };
}

function calculateSingleFood(input: string): FoodCalculationItem | null {
  const labelResult = calculateFromNutritionLabel(input);
  if (labelResult) return labelResult;
  const normalized = input.trim().toLowerCase().replace(/\s+/g, "");
  const food = findFood(normalized);
  if (!food) return null;

  const amountMatch = normalized.match(/(\d+(?:\.\d+)?|[一二两三四五六七八九十]+)(千克|公斤|kg|克|g|毫升|ml|碗|个|根|杯|份|片|勺)/i);
  const count = amountMatch ? parseCount(amountMatch[1]) : 1;
  const unit = amountMatch?.[2]?.toLowerCase() || food.servingLabel;
  let grams: number;
  if (["千克", "公斤", "kg"].includes(unit)) grams = count * 1000;
  else if (["克", "g", "毫升", "ml"].includes(unit)) grams = count;
  else grams = count * food.servingGrams;
  const ratio = grams / 100;

  return {
    input: input.trim(),
    name: food.name,
    amount: amountMatch ? `${count}${amountMatch[2]}` : `1${food.servingLabel}`,
    grams: round(grams),
    calories: Math.round(food.per100g.calories * ratio),
    protein: round(food.per100g.protein * ratio),
    carbs: round(food.per100g.carbs * ratio),
    fat: round(food.per100g.fat * ratio),
  };
}

export function calculateFood(query: string): FoodCalculation | null {
  const parts = query.split(/[\/／|、\n]+/).map((part) => part.trim()).filter(Boolean);
  const calculated = parts.map((part) => ({ input: part, result: calculateSingleFood(part) }));
  const items = calculated.flatMap(({ result }) => result ? [result] : []);
  const unmatched = calculated.filter(({ result }) => !result).map(({ input }) => input);
  if (items.length === 0) return null;
  return {
    name: items.map((item) => item.name).join(" / "),
    amount: items.length === 1 ? items[0].amount : `${items.length}项`,
    grams: round(items.reduce((sum, item) => sum + item.grams, 0)),
    matchedFood: items.map((item) => item.name).join(" / "),
    calories: items.reduce((sum, item) => sum + item.calories, 0),
    protein: round(items.reduce((sum, item) => sum + item.protein, 0)),
    carbs: round(items.reduce((sum, item) => sum + item.carbs, 0)),
    fat: round(items.reduce((sum, item) => sum + item.fat, 0)),
    items,
    unmatched,
  };
}
