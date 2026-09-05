import { useCallback, useEffect, useState } from "react";
import { ObjectDetailPanelBody } from "@/components/object-detail/registry";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useObjectDetailInternal,
  type ObjectDetailPanelControllers,
} from "@/context/ObjectDetailContext";
import { useIsLargeScreen } from "@/hooks/useIsLargeScreen";
import { useDetailPanelWidth } from "@/hooks/useDetailPanelWidth";
import { OBJECT_DETAIL_TYPE_META } from "@/lib/objectDetail";
import { cn } from "@/lib/utils";

export default function ObjectDetailHost() {
  const {
    target,
    pendingAction,
    requestClose,
    clearPendingAction,
    commitPendingAction,
    getPanelControllers,
    subscribeControllers,
  } = useObjectDetailInternal();

  const isLargeScreen = useIsLargeScreen();
  const { width: detailPanelWidth, persistWidth: persistDetailPanelWidth } =
    useDetailPanelWidth();

  const [controllers, setControllers] = useState<ObjectDetailPanelControllers | null>(
    null,
  );
  const [guardBusy, setGuardBusy] = useState(false);

  useEffect(() => {
    setControllers(getPanelControllers());
    return subscribeControllers(() => {
      setControllers(getPanelControllers());
    });
  }, [getPanelControllers, subscribeControllers, target]);

  const title =
    controllers?.title ??
    (target
      ? `${OBJECT_DETAIL_TYPE_META[target.type].typeLabel} · …`
      : "Object detail");

  const handleSaveClick = useCallback(async () => {
    const current = getPanelControllers();
    if (!current?.canUpdate) return;
    await current.save();
  }, [getPanelControllers]);

  const handleDiscardClick = useCallback(() => {
    getPanelControllers()?.discard();
  }, [getPanelControllers]);

  const handleGuardSave = useCallback(async () => {
    const current = getPanelControllers();
    if (!current) return;
    setGuardBusy(true);
    try {
      await current.save();
      commitPendingAction();
    } catch {
      // Keep sheet + dialog open; panel toast already shown.
    } finally {
      setGuardBusy(false);
    }
  }, [commitPendingAction, getPanelControllers]);

  const handleGuardDiscard = useCallback(() => {
    getPanelControllers()?.discard();
    commitPendingAction();
  }, [commitPendingAction, getPanelControllers]);

  return (
    <>
      <Sheet
        open={target != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <SheetContent
          side={isLargeScreen ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-4 overflow-hidden",
            isLargeScreen ? "sm:max-w-none" : "max-h-[70vh]",
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

          <SheetHeader className="shrink-0">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">
              Quick look and edit for this object without leaving the current page.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {target ? (
              <ObjectDetailPanelBody
                key={`${target.type}:${target.id}:${target.momentId ?? ""}:${target.sceneId ?? ""}:${target.sceneEndMomentId ?? ""}`}
                type={target.type}
                objectId={target.id}
                momentId={target.momentId}
                sceneId={target.sceneId}
                sceneLabel={target.sceneLabel}
                sceneEndMomentId={target.sceneEndMomentId}
              />
            ) : null}
          </div>

          {controllers?.canUpdate ? (
            <SheetFooter className="shrink-0 -mx-6 -mb-6 -mt-4 gap-2 border-t bg-background px-6 pt-4 pb-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={!controllers.dirty}
                onClick={handleDiscardClick}
              >
                Discard
              </Button>
              <Button
                type="button"
                disabled={!controllers.dirty}
                onClick={() => void handleSaveClick()}
              >
                Save
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open && !guardBusy) clearPendingAction();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save your changes, discard them, or keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={guardBusy}
              onClick={() => clearPendingAction()}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={guardBusy}
              onClick={handleGuardDiscard}
            >
              Discard
            </Button>
            <Button
              type="button"
              disabled={guardBusy}
              onClick={() => void handleGuardSave()}
            >
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
