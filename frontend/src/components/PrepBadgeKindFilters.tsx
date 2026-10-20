import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ALL_MOMENT_ATTACHMENT_KINDS,
  MOMENT_ATTACHMENT_LABELS,
  type MomentAttachmentKind,
} from "@/lib/domainIcons";

interface PrepBadgeKindFiltersProps {
  enabledKinds: MomentAttachmentKind[];
  onChange: (kinds: MomentAttachmentKind[]) => void;
  disabled?: boolean;
  className?: string;
}

export default function PrepBadgeKindFilters({
  enabledKinds,
  onChange,
  disabled = false,
  className,
}: PrepBadgeKindFiltersProps) {
  const enabled = new Set(enabledKinds);

  function toggleKind(kind: MomentAttachmentKind, checked: boolean) {
    if (checked) {
      if (enabled.has(kind)) return;
      onChange(
        ALL_MOMENT_ATTACHMENT_KINDS.filter(
          (item) => item === kind || enabled.has(item),
        ),
      );
      return;
    }
    onChange(enabledKinds.filter((item) => item !== kind));
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs text-muted-foreground">Show badges for</p>
      <div className="flex flex-col gap-1.5">
        {ALL_MOMENT_ATTACHMENT_KINDS.map((kind) => (
          <Label key={kind} className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={enabled.has(kind)}
              disabled={disabled}
              onCheckedChange={(value) => toggleKind(kind, value === true)}
            />
            {MOMENT_ATTACHMENT_LABELS[kind]}
          </Label>
        ))}
      </div>
    </div>
  );
}

/** When turning prep badges on with an empty kind list, restore the full set. */
export function ensurePrepBadgeKinds(
  kinds: MomentAttachmentKind[],
): MomentAttachmentKind[] {
  return kinds.length > 0 ? kinds : [...ALL_MOMENT_ATTACHMENT_KINDS];
}
