import { useEffect } from "react";
import {
  useObjectDetailInternal,
  type ObjectDetailPanelControllers,
} from "@/context/ObjectDetailContext";

/** Panels call this so the host can show title, Save/Discard, and dirty guards. */
export function useRegisterObjectDetailPanel(
  controllers: ObjectDetailPanelControllers | null,
) {
  const { registerPanelControllers } = useObjectDetailInternal();

  useEffect(() => {
    registerPanelControllers(controllers);
    return () => {
      registerPanelControllers(null);
    };
  }, [
    controllers,
    controllers?.title,
    controllers?.dirty,
    controllers?.canUpdate,
    controllers?.save,
    controllers?.discard,
    registerPanelControllers,
  ]);
}
