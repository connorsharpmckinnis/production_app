import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import ObjectPeekBody from "@/components/object-detail/ObjectPeekBody";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useObjectDetail } from "@/context/ObjectDetailContext";
import { useProductionAccess } from "@/context/ProductionAccessContext";
import { useObjectPeekData } from "@/hooks/queries/useObjectPeekData";
import { usePrefetchObjectDetail } from "@/hooks/queries/usePrefetchObjectDetail";
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
 * Fine-pointer hover shows a short Radix HoverCard preview from cached data.
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
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const { openDetail, productionId } = useObjectDetail();
    const { hasCapability } = useProductionAccess();
    const meta = OBJECT_DETAIL_TYPE_META[objectType];
    const canRead = hasCapability(meta.resource, "read");
    const content = children ?? label;
    // Skip peek/prefetch fetches when the user cannot open this object.
    const peekProductionId = canRead ? productionId : null;
    const { prefetch, cancelPrefetch } = usePrefetchObjectDetail(peekProductionId);
    const peekContent = useObjectPeekData(
      peekProductionId,
      objectType,
      objectId,
      momentId,
    );

    if (!canRead) {
      return <>{content}</>;
    }

    return (
      <HoverCard openDelay={280} closeDelay={120}>
        <HoverCardTrigger asChild>
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
            onPointerEnter={(event) => {
              onPointerEnter?.(event);
              prefetch(objectType, objectId, momentId);
            }}
            onPointerLeave={(event) => {
              onPointerLeave?.(event);
              cancelPrefetch();
            }}
            onFocus={(event) => {
              onFocus?.(event);
              prefetch(objectType, objectId, momentId);
            }}
            onBlur={(event) => {
              onBlur?.(event);
              cancelPrefetch();
            }}
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
            <SquareArrowOutUpRight
              className="size-2.5 shrink-0 opacity-80"
              aria-hidden
            />
          </button>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-72">
          <ObjectPeekBody content={peekContent} />
        </HoverCardContent>
      </HoverCard>
    );
  },
);

export default ObjectLink;
