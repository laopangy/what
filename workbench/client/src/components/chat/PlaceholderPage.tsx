interface PlaceholderPageProps {
  title: string;
  icon: string;
}

export default function PlaceholderPage({ title, icon }: PlaceholderPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg p-5">
      <div className="w-full max-w-lg rounded-xl border border-border/70 bg-surface/80 p-8 text-center shadow-[0_18px_50px_rgb(0_0_0_/_0.24)]">
        <p className="text-[9px] uppercase tracking-[0.28em] text-accent-dim/60 mb-5">Module preview</p>
        <div className="text-4xl mb-4 grayscale-[0.25]">{icon}</div>
        <h1 className="text-xl font-semibold text-text mb-1.5">{title}</h1>
        <p className="text-[11px] text-text-dim/65">模块正在整理中，稍后在这里继续。</p>
        <div className="mt-6 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      </div>
    </div>
  );
}
