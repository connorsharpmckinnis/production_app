import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import type { ObjectDetailTarget } from "@/lib/objectDetail";

export interface ObjectDetailPanelControllers {
  title: string;
  dirty: boolean;
  canUpdate: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

export type ObjectDetailPendingAction =
  | { kind: "close" }
  | { kind: "replace"; target: ObjectDetailTarget };

interface ObjectDetailContextValue {
  productionId: number | null;
  target: ObjectDetailTarget | null;
  pendingAction: ObjectDetailPendingAction | null;
  openDetail: (target: ObjectDetailTarget) => void;
  /** Request close; may set pendingAction when dirty. */
  requestClose: () => void;
  clearPendingAction: () => void;
  /** Apply close/replace after dirty guard (or immediately when clean). */
  commitPendingAction: () => void;
  registerPanelControllers: (controllers: ObjectDetailPanelControllers | null) => void;
  getPanelControllers: () => ObjectDetailPanelControllers | null;
  applyTarget: (target: ObjectDetailTarget | null) => void;
  subscribeControllers: (listener: () => void) => () => void;
}

const ObjectDetailContext = createContext<ObjectDetailContextValue | null>(null);

function targetsEqual(a: ObjectDetailTarget | null, b: ObjectDetailTarget): boolean {
  return (
    a != null &&
    a.type === b.type &&
    a.id === b.id &&
    (a.momentId ?? null) === (b.momentId ?? null) &&
    (a.sceneId ?? null) === (b.sceneId ?? null) &&
    (a.sceneEndMomentId ?? null) === (b.sceneEndMomentId ?? null)
  );
}

export function ObjectDetailProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const productionId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const [target, setTarget] = useState<ObjectDetailTarget | null>(null);
  const [pendingAction, setPendingAction] = useState<ObjectDetailPendingAction | null>(
    null,
  );
  const controllersRef = useRef<ObjectDetailPanelControllers | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const notifyControllers = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const registerPanelControllers = useCallback(
    (controllers: ObjectDetailPanelControllers | null) => {
      controllersRef.current = controllers;
      notifyControllers();
    },
    [notifyControllers],
  );

  const getPanelControllers = useCallback(() => controllersRef.current, []);

  const subscribeControllers = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const applyTarget = useCallback((next: ObjectDetailTarget | null) => {
    controllersRef.current = null;
    setPendingAction(null);
    setTarget(next);
  }, []);

  const openDetail = useCallback(
    (next: ObjectDetailTarget) => {
      if (productionId == null) return;
      if (targetsEqual(target, next)) return;

      if (target != null && controllersRef.current?.dirty) {
        setPendingAction({ kind: "replace", target: next });
        return;
      }

      applyTarget(next);
    },
    [applyTarget, productionId, target],
  );

  const requestClose = useCallback(() => {
    if (target == null) return;
    if (controllersRef.current?.dirty) {
      setPendingAction({ kind: "close" });
      return;
    }
    applyTarget(null);
  }, [applyTarget, target]);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const commitPendingAction = useCallback(() => {
    setPendingAction((current) => {
      if (current == null) return null;
      if (current.kind === "close") {
        controllersRef.current = null;
        setTarget(null);
        return null;
      }
      controllersRef.current = null;
      setTarget(current.target);
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      productionId,
      target,
      pendingAction,
      openDetail,
      requestClose,
      clearPendingAction,
      commitPendingAction,
      registerPanelControllers,
      getPanelControllers,
      applyTarget,
      subscribeControllers,
    }),
    [
      productionId,
      target,
      pendingAction,
      openDetail,
      requestClose,
      clearPendingAction,
      commitPendingAction,
      registerPanelControllers,
      getPanelControllers,
      applyTarget,
      subscribeControllers,
    ],
  );

  return (
    <ObjectDetailContext.Provider value={value}>{children}</ObjectDetailContext.Provider>
  );
}

export function useObjectDetail(): Pick<
  ObjectDetailContextValue,
  "openDetail" | "requestClose" | "target" | "productionId"
> {
  const ctx = useContext(ObjectDetailContext);
  if (!ctx) {
    throw new Error("useObjectDetail must be used within ObjectDetailProvider");
  }
  return {
    openDetail: ctx.openDetail,
    requestClose: ctx.requestClose,
    target: ctx.target,
    productionId: ctx.productionId,
  };
}

/** Host + panels only. */
export function useObjectDetailInternal(): ObjectDetailContextValue {
  const ctx = useContext(ObjectDetailContext);
  if (!ctx) {
    throw new Error("useObjectDetailInternal must be used within ObjectDetailProvider");
  }
  return ctx;
}
