import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import MomentDetailPanel, {
  type MomentDetailPanelHandle,
} from "@/components/MomentDetailPanel";
import { useIsLargeScreen } from "@/hooks/useIsLargeScreen";
import { useDetailPanelWidth } from "@/hooks/useDetailPanelWidth";
import type {
  AppSettingsResponse,
  CastableUserResponse,
  CharacterDetailResponse,
  CostumeResponse,
  CueCategoryResponse,
  GroupResponse,
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
  sceneId: number | null;
  canEdit: boolean;
  canEditScript: boolean;
  characters: CharacterDetailResponse[];
  castableUsers: CastableUserResponse[];
  groups: GroupResponse[];
  songs: SongDetailResponse[];
  propsCatalog: PropResponse[];
  setPiecesCatalog: SetPieceResponse[];
  costumesCatalog: CostumeResponse[];
  cueCategories: CueCategoryResponse[];
  momentTypes: MomentTypeResponse[];
  appSettings: AppSettingsResponse;
  onDetailUpdate: (detail: MomentDetailResponse) => void;
  onChanged: () => void | Promise<void>;
  /**
   * `inline` — co-planar desktop column (no overlay/scrim).
   * `overlay` — Sheet (right on large screens, bottom on small).
   * Default follows viewport: inline on large, overlay on small.
   */
  presentation?: "inline" | "overlay";
}

export default function MomentDetailSheet({
  productionId,
  open,
  onOpenChange,
  momentDetail,
  sceneId,
  canEdit,
  canEditScript,
  characters,
  castableUsers,
  groups,
  songs,
  propsCatalog,
  setPiecesCatalog,
  costumesCatalog,
  cueCategories,
  momentTypes,
  appSettings,
  onDetailUpdate,
  onChanged,
  presentation: presentationProp,
}: MomentDetailSheetProps) {
  const isLargeScreen = useIsLargeScreen();
  const presentation =
    presentationProp ?? (isLargeScreen ? "inline" : "overlay");
  const isInline = presentation === "inline";
  const { width: detailPanelWidth, persistWidth: persistDetailPanelWidth } =
    useDetailPanelWidth();
  const detailPanelRef = useRef<MomentDetailPanelHandle>(null);
  const [scriptDirty, setScriptDirty] = useState(false);
  const [footerBusy, setFooterBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setScriptDirty(false);
      setFooterBusy(false);
    }
  }, [open]);

  useEffect(() => {
    setScriptDirty(false);
  }, [momentDetail?.id]);

  const requestClose = useCallback(() => {
    setFooterBusy(true);
    void detailPanelRef.current?.flushPendingSaves().finally(() => {
      setFooterBusy(false);
      onOpenChange(false);
    });
  }, [onOpenChange]);

  // Escape closes the co-planar inspector (Sheet handles this for overlay).
  useEffect(() => {
    if (!open || !isInline) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isInline, requestClose]);

  function bindResizeHandle(event: React.MouseEvent) {
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
  }

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm font-medium">
          {momentDetail
            ? `Moment #${momentDetail.sequence_number}`
            : "Moment detail"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={requestClose}
          disabled={footerBusy}
          aria-label="Close moment detail"
          title="Close"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {momentDetail ? (
          <MomentDetailPanel
            ref={detailPanelRef}
            productionId={productionId}
            detail={momentDetail}
            sceneId={sceneId}
            canEdit={canEdit}
            canEditScript={canEditScript}
            canChooseVisibility={canEdit}
            characters={characters}
            castableUsers={castableUsers}
            groups={groups}
            songs={songs}
            propsCatalog={propsCatalog}
            setPiecesCatalog={setPiecesCatalog}
            costumesCatalog={costumesCatalog}
            cueCategories={cueCategories}
            momentTypes={momentTypes}
            appSettings={appSettings}
            momentBadgeClass={momentBadgeClass}
            onDetailUpdate={onDetailUpdate}
            onChanged={onChanged}
            onScriptDirtyChange={setScriptDirty}
            hideScriptPreview
          />
        ) : (
          <DetailPanelSkeleton />
        )}
      </div>
      {canEditScript && scriptDirty && (
        <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!scriptDirty || footerBusy}
            onClick={() => detailPanelRef.current?.discardScript()}
          >
            Discard
          </Button>
          <Button
            type="button"
            disabled={!scriptDirty || footerBusy}
            onClick={() => {
              setFooterBusy(true);
              void detailPanelRef.current
                ?.saveScript()
                .finally(() => setFooterBusy(false));
            }}
          >
            Save
          </Button>
        </div>
      )}
    </>
  );

  if (isInline) {
    if (!open) return null;

    return (
      <aside
        className="relative flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-background"
        style={{ width: detailPanelWidth, maxWidth: detailPanelWidth }}
        aria-label="Moment inspector"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize detail panel"
          onMouseDown={bindResizeHandle}
          className="absolute top-0 left-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize hover:bg-primary/20"
        />
        {panelBody}
      </aside>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          requestClose();
        }
      }}
    >
      <SheetContent
        side={isLargeScreen ? "right" : "bottom"}
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isLargeScreen ? "sm:max-w-none" : "h-dvh max-h-dvh inset-x-0",
        )}
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
            onMouseDown={bindResizeHandle}
            className="absolute top-0 left-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize hover:bg-primary/20"
          />
        )}
        {panelBody}
        <SheetTitle className="sr-only">
          {momentDetail
            ? `Moment ${momentDetail.sequence_number}`
            : "Moment detail"}
        </SheetTitle>
      </SheetContent>
    </Sheet>
  );
}
