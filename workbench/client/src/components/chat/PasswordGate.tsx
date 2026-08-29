import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Database, Eye, EyeOff, Fingerprint, FolderLock, KeyRound, LoaderCircle } from "lucide-react";
import WindowTitleBar from "../layout/WindowTitleBar";

const STORAGE_SERVICES = ["http://localhost:3002", "http://localhost:3003"];

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    Promise.all(STORAGE_SERVICES.map((base) => fetch(`${base}/api/health`).then((response) => response.json())))
      .then((states) => setAuthed(states.every((state) => state.unlocked === true)))
      .catch(() => setError("数据服务尚未就绪，请稍后重试"))
      .finally(() => setChecking(false));
  }, []);

  const handleUnlock = async () => {
    if (!pwd || unlocking) return;
    setUnlocking(true);
    setError("");
    try {
      const responses = await Promise.all(STORAGE_SERVICES.map((base) => fetch(`${base}/api/storage/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      })));
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const body = await failed.json().catch(() => ({}));
        throw new Error(body.error || "密码错误，请重新输入");
      }
      setAuthed(true);
      setPwd("");
    } catch (unlockError: unknown) {
      setError(unlockError instanceof Error ? unlockError.message : "暂时无法解锁，请重试");
      setPwd("");
    } finally {
      setUnlocking(false);
    }
  };

  if (checking) {
    return (
      <main className="vault-shell min-h-screen grid place-items-center text-text-dim">
        <div className="flex items-center gap-3 text-xs tracking-wide">
          <LoaderCircle className="w-4 h-4 animate-spin text-accent" />
          正在连接加密数据仓库
        </div>
      </main>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div className="vault-shell min-h-screen overflow-hidden text-text">
      <header className="absolute inset-x-0 top-0 z-40 h-14 flex items-center px-5 [-webkit-app-region:drag]">
        <div className="flex items-center gap-2.5 text-white/70 select-none">
          <span className="grid w-7 h-7 place-items-center rounded-lg bg-white/[0.09] text-[10px] font-semibold text-white ring-1 ring-inset ring-white/10">潘</span>
          <span className="text-[11px] font-medium tracking-[0.08em]">WHAT · 私人工作台</span>
        </div>
        <WindowTitleBar />
      </header>

      <main className="relative min-h-screen px-6 pt-20 pb-8 grid place-items-center">
        <div className="vault-enter relative z-10 w-full max-w-[940px] grid overflow-hidden rounded-[1.75rem] border border-white/[0.10] bg-[#33414a]/70 shadow-[0_32px_90px_rgb(21_34_42_/_0.38),inset_0_1px_rgb(255_255_255_/_0.08)] backdrop-blur-2xl md:grid-cols-[1.08fr_0.92fr]">
          <section className="relative hidden min-h-[510px] flex-col justify-between overflow-hidden border-r border-white/[0.07] p-10 md:flex">
            <div className="vault-halo" aria-hidden="true" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-2 text-[10px] font-medium tracking-[0.16em] text-accent-dim">
                <span className="h-px w-7 bg-accent/60" />
                PRIVATE SPACE
              </div>
              <h1 className="max-w-md text-[2.55rem] font-semibold leading-[1.08] tracking-[-0.045em] text-white text-balance">
                你的数据，<br />只在解锁后出现
              </h1>
              <p className="mt-5 max-w-[28rem] text-[12px] leading-6 text-white/55 text-pretty">
                日记、训练计划和定时任务统一保存在项目内的加密仓库。离开工作台后，磁盘上仍然只有密文。
              </p>
            </div>

            <div className="relative grid gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-4 py-3 ring-1 ring-inset ring-white/[0.055]">
                <Database className="h-4 w-4 text-accent" strokeWidth={1.6} />
                <div><p className="text-[11px] font-medium text-white/85">单一数据仓库</p><p className="mt-0.5 text-[9px] text-white/40">计划、记录与历史统一保存</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-4 py-3 ring-1 ring-inset ring-white/[0.055]">
                <FolderLock className="h-4 w-4 text-accent" strokeWidth={1.6} />
                <div><p className="text-[11px] font-medium text-white/85">项目内加密</p><p className="mt-0.5 text-[9px] text-white/40">原始内容不会以明文落盘</p></div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[510px] flex-col justify-center bg-[#45545e]/34 px-7 py-10 sm:px-10">
            <div className="mb-8">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-[0.9rem] bg-accent/[0.11] text-accent ring-1 ring-inset ring-accent/25 shadow-[0_10px_30px_rgb(0_232_137_/_0.09)]">
                <Fingerprint className="h-6 w-6" strokeWidth={1.55} />
              </div>
              <p className="mb-2 text-[9px] font-medium tracking-[0.16em] text-white/38">WELCOME BACK</p>
              <h2 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-white">解锁工作台</h2>
              <p className="mt-2 text-[11px] leading-5 text-white/48">输入访问密码，解密本次会话中的私人数据。</p>
            </div>

            <div className="space-y-3">
              <label htmlFor="vault-password" className="block text-[10px] font-medium text-white/58">访问密码</label>
              <div className={`group flex h-12 items-center gap-3 rounded-xl bg-[#26343d]/55 px-3.5 ring-1 ring-inset transition-all duration-200 ${error ? "ring-red-300/45" : "ring-white/[0.10] focus-within:ring-accent/50 focus-within:bg-[#26343d]/78"}`}>
                <KeyRound className="h-4 w-4 shrink-0 text-white/35 group-focus-within:text-accent" strokeWidth={1.6} />
                <input
                  id="vault-password"
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(event) => { setPwd(event.target.value); setError(""); }}
                  onKeyDown={(event) => event.key === "Enter" && void handleUnlock()}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/24"
                />
                <button type="button" onClick={() => setShow((visible) => !visible)} aria-label={show ? "隐藏密码" : "显示密码"} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/65">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="min-h-5" aria-live="polite">
                {error && <p className="flex items-center gap-1.5 text-[10px] text-red-200/90"><span className="h-1 w-1 rounded-full bg-red-300" />{error}</p>}
              </div>

              <button type="button" onClick={() => void handleUnlock()} disabled={!pwd || unlocking} className="group flex h-12 w-full items-center justify-between rounded-xl bg-accent px-4 text-[#133127] shadow-[0_12px_28px_rgb(0_232_137_/_0.14)] transition duration-200 hover:bg-accent-dim hover:shadow-[0_16px_34px_rgb(0_232_137_/_0.19)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35">
                <span className="text-[11px] font-semibold">{unlocking ? "正在解密" : "进入工作台"}</span>
                {unlocking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </div>

            <p className="mt-7 flex items-center gap-2 text-[9px] leading-4 text-white/30">
              <span className="h-1.5 w-1.5 rounded-full bg-accent/65 shadow-[0_0_8px_rgb(0_232_137_/.55)]" />
              data/what.vault · 仅在当前会话中解锁
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
