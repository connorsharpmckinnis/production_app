import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { useObjectDetail } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import {
  OBJECT_DETAIL_TYPE_META,
  type ObjectDetailType,
} from "@/lib/objectDetail";
import { cn } from "@/lib/utils";

export interface ObjectLinkProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> {
  objectType: ObjectDetailType;
  objectId: number;
  /** Required when opening moment-scoped objects (cue). */
  momentId?: number;
  /** Optional scene filter (Character from scene summary, etc.). */
  sceneId?: number;
  sceneLabel?: string;
  sceneEndMomentId?: number;
  /** Visible text when `children` is omitted. */
  label?: ReactNode;
  children?: ReactNode;
}

/**
 * Reference control that opens the object detail sheet when the user can read
 * that resource. Otherwise renders plain text (no affordance).
 */
const ObjectLink = forwardRef<HTMLButtonElement, ObjectLinkProps>(
  function ObjectLink(
    {
      objectType,
      objectId,
      momentId,
      sceneId,
      sceneLabel,
      sceneEndMomentId,
      label,
      children,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const { openDetail } = useObjectDetail();
    const { hasCapability } = useProductionAccess();
    const meta = OBJECT_DETAIL_TYPE_META[objectType];
    const canRead = hasCapability(meta.resource, "read");
    const content = children ?? label;

    if (!canRead) {
      return <>{content}</>;
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        title={`Open ${meta.typeLabel.toLowerCase()} details`}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 align-baseline font-medium text-secondary-foreground",
          "hover:bg-secondary/80",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        onClick={(event) => {
          event.stopPropagation();
          openDetail({
            type: objectType,
            id: objectId,
            momentId,
            sceneId,
            sceneLabel,
            sceneEndMomentId,
          });
        }}
        {...rest}
      >
        <span className="min-w-0 truncate">{content}</span>
        <SquareArrowOutUpRight className="size-2.5 shrink-0 opacity-80" aria-hidden />
      </button>
    );
  },
);

export default ObjectLink;
