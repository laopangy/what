import type { PetAction } from "../../types/pet";

const lines: Partial<Record<PetAction, string[]>> = {
  idle: ["我在这里陪你。", "今天也慢慢来。", "需要休息时记得叫我。"],
  happy: ["被你发现啦。", "再陪我玩一会儿。", "今天的心情变好啦。"],
  curious: ["你在忙什么呢？", "这里好像有新东西。", "让我认真看看。"],
  stretch: ["伸个懒腰，继续陪你。", "活动一下会更舒服。"],
  groom: ["我要整理一下毛毛。", "很快就收拾好。"],
  sleep: ["我先眯一会儿。", "安静陪你工作。"],
  wake: ["醒啦，我还在。", "休息好了。"],
};

export function chooseDialogue(action: PetAction): string {
  const options = lines[action] ?? lines.idle ?? [];
  return options[Math.floor(Math.random() * options.length)] ?? "我在这里。";
}
