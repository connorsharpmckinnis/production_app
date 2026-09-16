import { useEffect, useRef, useState } from "react";
import DetailPanelSkeleton from "@/components/DetailPanelSkeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter } from "@/components/ui/sheet";
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
}: MomentDetailSheetProps) {
  const isLargeScreen = useIsLargeScreen();
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

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setFooterBusy(true);
          void detailPanelRef.current?.flushPendingSaves().finally(() => {
            setFooterBusy(false);
            onOpenChange(false);
          });
        }
      }}
    >
      <SheetContent
        side={isLargeScreen ? "right" : "bottom"}
        className={cn(
          "flex flex-col gap-4 overflow-hidden",
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
        <div className="min-h-0 flex-1 overflow-y-auto">
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
            />
          ) : (
            <DetailPanelSkeleton />
          )}
        </div>
        {canEditScript && scriptDirty && (
          <SheetFooter className="shrink-0 -mx-6 -mb-6 -mt-4 gap-2 border-t bg-background px-6 pt-4 pb-6 sm:flex-row sm:justify-end">
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
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
