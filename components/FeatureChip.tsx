import type { LucideIcon } from "lucide-react";

export default function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel px-3.5 py-1.5 text-xs font-medium text-ink-muted shadow-sm">
      <Icon className="w-3.5 h-3.5 text-brand-600" strokeWidth={2.5} />
      {label}
    </span>
  );
}
