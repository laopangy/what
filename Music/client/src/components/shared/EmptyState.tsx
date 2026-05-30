interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-dim bg-[#fef6f0] rounded-3xl p-8">
      {icon && <div className="mb-1 opacity-40">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-text-dim/60">{description}</p>}
    </div>
  );
}
