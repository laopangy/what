import { useEffect, useState, type ReactNode } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

const STORAGE_SERVICES = ["http://localhost:3002", "http://localhost:3003"];

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    Promise.all(STORAGE_SERVICES.map((base) => fetch(`${base}/api/health`).then((response) => response.json())))
      .then((states) => setAuthed(states.every((state) => state.unlocked === true)))
      .catch(() => setError("数据服务尚未启动"))
      .finally(() => setChecking(false));
  }, []);

  const handleUnlock = async () => {
    try {
      const responses = await Promise.all(STORAGE_SERVICES.map((base) => fetch(`${base}/api/storage/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      })));
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const body = await failed.json().catch(() => ({}));
        throw new Error(body.error || "密码错误");
      }
      setAuthed(true);
      setPwd("");
    } catch (unlockError: unknown) {
      setError(unlockError instanceof Error ? unlockError.message : "解锁失败");
      setPwd("");
    }
  };

  if (checking) return <div className="flex-1 grid place-items-center bg-bg text-text-dim text-xs">正在检查加密数据仓库…</div>;
  if (authed) return <>{children}</>;

  return (
    <div className="flex-1 flex items-center justify-center bg-bg p-5">
      <div className="w-full max-w-xs mx-auto p-6 rounded-xl border border-border/70 bg-surface/85 shadow-[0_18px_50px_rgb(0_0_0_/_0.28)]">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/12 border border-accent/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-accent-dim" strokeWidth={1.7} />
          </div>
          <h2 className="text-lg font-bold text-text mb-1">需要密码</h2>
          <p className="text-xs text-text-dim">输入密码以访问此模块</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && void handleUnlock()}
              placeholder="请输入密码"
              autoFocus
              className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-bg/70 border border-border text-text text-[12px] placeholder:text-text-dim/40 focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim/50 hover:text-text-dim"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-400">{error}</p>}

          <button
            onClick={() => void handleUnlock()}
            disabled={!pwd}
            className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-dim text-[#17130a] text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            解锁
          </button>
        </div>
      </div>
    </div>
  );
}
