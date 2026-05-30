export default function LoadingSpinner({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
      <span className="text-sm text-text-dim">{text}</span>
    </div>
  );
}
