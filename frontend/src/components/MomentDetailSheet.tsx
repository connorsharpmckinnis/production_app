import { useRef } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import MomentDetailPanel, {
  type MomentDetailPanelHandle,
} from "@/components/MomentDetailPanel";
import { useIsLargeScreen } from "@/hooks/useIsLargeScreen";
import { useDetailPanelWidth } from "@/hooks/useDetailPanelWidth";
import type {
  AppSettingsResponse,
  CharacterDetailResponse,
  CueCategoryResponse,
  MicrophoneResponse,
  MomentDetailResponse,
  MomentTypeResponse,
  PropResponse,
  SetPieceResponse,
  SongDetailResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { momentBadgeClass } from "@/lib/momentStyles";

interface MomentDetailSheetProps {
  productionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentDetail: MomentDetailResponse | null;
  canEdit: boolean;
  characters: CharacterDetailResponse[];
  songs: SongDetailResponse[];
  propsCatalog: PropResponse[];
  microphonesCatalog: MicrophoneResponse[];
  setPiecesCatalog: SetPieceResponse[];
  cueCategories: CueCategoryResponse[];
  momentTypes: MomentTypeResponse[];
  appSettings: AppSettingsResponse;
  onDetailUpdate: (detail: MomentDetailResponse) => void;
  onChanged: () => void | Promise<void>;
}

export default function MomentDetailSheet({
  productionId,
  open,
  onOpenChange,
  momentDetail,
  canEdit,
  characters,
  songs,
  propsCatalog,
  microphonesCatalog,
  setPiecesCatalog,
  cueCategories,
  momentTypes,
  appSettings,
  onDetailUpdate,
  onChanged,
}: MomentDetailSheetProps) {
  const isLargeScreen = useIsLargeScreen();
  const { width: detailPanelWidth, persistWidth: persistDetailPanelWidth } =
    useDetailPanelWidth();
  const detailPanelRef = useRef<MomentDetailPanelHandle>(null);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          void detailPanelRef.current?.flushPendingSaves().finally(() => {
            onOpenChange(false);
          });
        }
      }}
    >
      <SheetContent
        side={isLargeScreen ? "right" : "bottom"}
        className={cn("overflow-y-auto", isLargeScreen ? "sm:max-w-none" : "max-h-[70vh]")}
        style={
          isLargeScreen
            ? { width: detailPanelWidth, maxWidth: detailPanelWidth }
            : undefined
        }
      >
        {isLargeScreen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize detail panel"
            onMouseDown={(event) => {
              event.preventDefault();
              const startX = event.clientX;
              const startWidth = detailPanelWidth;

              function onMouseMove(moveEvent: MouseEvent) {
                persistDetailPanelWidth(startWidth - (moveEvent.clientX - startX));
              }

              function onMouseUp() {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
              }

              window.addEventListener("mousemove", onMouseMove);
              window.addEventListener("mouseup", onMouseUp);
            }}
            className="absolute top-0 left-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize hover:bg-primary/20"
          />
        )}
        {momentDetail ? (
          <MomentDetailPanel
            ref={detailPanelRef}
            productionId={productionId}
            detail={momentDetail}
            canEdit={canEdit}
            canChooseVisibility={canEdit}
            characters={characters}
            songs={songs}
            propsCatalog={propsCatalog}
            microphonesCatalog={microphonesCatalog}
            setPiecesCatalog={setPiecesCatalog}
            cueCategories={cueCategories}
            momentTypes={momentTypes}
            appSettings={appSettings}
            momentBadgeClass={momentBadgeClass}
            onDetailUpdate={onDetailUpdate}
            onChanged={onChanged}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading moment detail…</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
