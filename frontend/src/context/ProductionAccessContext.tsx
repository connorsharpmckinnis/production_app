import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import type { ProductionAccessResponse } from "@/lib/types";

interface ProductionAccessContextValue {
  access: ProductionAccessResponse | null;
  loading: boolean;
  error: string | null;
  hasCapability: (resource: string, action: string) => boolean;
}

const ProductionAccessContext =
  createContext<ProductionAccessContextValue | null>(null);

export function ProductionAccessProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user } = useAuth();
  const [access, setAccess] = useState<ProductionAccessResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setAccess(null);
      setError(null);
      setLoading(false);
      return;
    }

    const productionId = Number(id);
    if (!Number.isFinite(productionId)) {
      setAccess(null);
      setError("Invalid production.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .getProductionAccess(productionId)
      .then((nextAccess) => {
        if (!cancelled) setAccess(nextAccess);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAccess(null);
          setError(formatApiError(err, "Could not load production access."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const hasCapability = useCallback(
    (resource: string, action: string) => {
      if (isAdmin) return true;
      return access?.capabilities.includes(`${resource}:${action}`) ?? false;
    },
    [access, isAdmin],
  );

  const value = useMemo(
    () => ({ access, loading, error, hasCapability }),
    [access, loading, error, hasCapability],
  );

  return (
    <ProductionAccessContext.Provider value={value}>
      {children}
    </ProductionAccessContext.Provider>
  );
}

export function useProductionAccess() {
  const context = useContext(ProductionAccessContext);
  if (!context) {
    throw new Error(
      "useProductionAccess must be used within ProductionAccessProvider",
    );
  }
  return context;
}
