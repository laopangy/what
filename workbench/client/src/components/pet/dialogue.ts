import type { PetAction } from "../../types/pet";

const common: Partial<Record<PetAction, string[]>> = {
  idle: ["我在这里陪你。", "今天也慢慢来。", "需要休息时记得叫我。"],
  happy: ["被你发现啦。", "再陪我玩一会儿。", "今天的心情变好啦。"],
  curious: ["你在忙什么呢？", "这里好像有新东西。", "让我认真看看。"],
  stretch: ["活动一下会更舒服。", "准备继续陪你。"],
  groom: ["我要整理一下。", "很快就收拾好。"],
  sleep: ["我先眯一会儿。", "安静陪你工作。"],
  wake: ["醒啦，我还在。", "休息好了。"],
};

const personalities: Record<string, Partial<Record<PetAction, string[]>>> = {
  "sunny-dog": {
    idle: ["随时可以出发！", "我会认真陪着你。"],
    happy: ["太好啦，再玩一次！", "见到你就很开心！"],
    curious: ["那里是不是有新任务？", "我闻到新鲜事了。"],
  },
  "ember-fox": {
    idle: ["我刚刚绕了一圈。", "安静不代表我没在观察。"],
    happy: ["嘿，被我绕到你身边了。", "这次探险很顺利。"],
    curious: ["这个角落有点可疑。", "让我先看看再告诉你。"],
  },
  "cloud-rabbit": {
    idle: ["这里很安静，我很喜欢。", "我会轻轻陪着你。"],
    happy: ["今天也有好心情。", "我可以再跳一下。"],
    curious: ["我听见了一点动静。", "让我竖起耳朵听听。"],
  },
  "bamboo-panda": {
    idle: ["慢一点也没关系。", "我正在认真发呆。"],
    happy: ["滚一圈就精神了。", "今天适合悠闲一点。"],
    sleep: ["尾巴借我当枕头。", "我只睡一小会儿。"],
  },
  "pixel-robot": {
    idle: ["陪伴程序运行正常。", "状态稳定，随时待命。"],
    happy: ["任务反馈：开心。", "庆祝程序已启动。"],
    curious: ["正在扫描新状态。", "发现值得关注的变化。"],
    sleep: ["进入低功耗模式。", "充电协议已启动。"],
    wake: ["电量充足，重新上线。", "系统已恢复。"],
  },
};

export function chooseDialogue(action: PetAction, petId = "mist-cat"): string {
  const options = personalities[petId]?.[action] ?? common[action] ?? common.idle ?? [];
  return options[Math.floor(Math.random() * options.length)] ?? "我在这里。";
}
