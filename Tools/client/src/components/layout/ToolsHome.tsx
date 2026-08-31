import { useNavigate } from "react-router-dom";
import { Clock, ArrowRight, Grid3X3, Wrench } from "lucide-react";

const tools = [
  {
    id: "timer",
    name: "定时器",
    description: "创建和管理定时任务，支持 Cron 表达式、HTTP 请求和 Shell 命令",
    icon: Clock,
    color: "bg-indigo-500/15 text-indigo-400",
    path: "/timer",
    active: true,
  },
  {
    id: "beads",
    name: "拼豆规格图",
    description: "上传图片，生成带格号、色号和用量统计的拼豆图纸",
    icon: Grid3X3,
    color: "bg-indigo-500/15 text-indigo-400",
    path: "/beads",
    active: true,
  },
];

export default function ToolsHome() {
  const navigate = useNavigate();

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
          <Wrench className="w-6 h-6 text-indigo-400" />
          工具
        </h1>
        <p className="text-sm text-slate-400 mt-2">实用工具集合，提升工作效率</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => navigate(tool.path)}
            className="group bg-slate-900 border border-slate-800 rounded-xl p-5 text-left hover:border-indigo-500/35 hover:bg-slate-900/80 transition-all cursor-pointer shadow-[0_12px_28px_rgb(0_0_0_/_0.16)]"
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl ${tool.color} flex items-center justify-center mb-4`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-1">{tool.name}</h3>
            <p className="text-sm text-slate-400">{tool.description}</p>
            {tool.active && (
              <span className="inline-block mt-3 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                已上线
              </span>
            )}
          </button>
        ))}

      </div>
    </div>
  );
}
