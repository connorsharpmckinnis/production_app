import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2Icon, CircleAlertIcon, InfoIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  message: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let toastId = 0;

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof InfoIcon; className: string; iconClassName: string }
> = {
  default: {
    icon: InfoIcon,
    className: "border-border",
    iconClassName: "text-muted-foreground",
  },
  success: {
    icon: CheckCircle2Icon,
    className: "border-emerald-500/35 bg-emerald-500/5",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: CircleAlertIcon,
    className: "border-destructive/40 bg-destructive/5",
    iconClassName: "text-destructive",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      message: (title, description) => push("default", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const variant = VARIANT_STYLES[toast.variant];
          const Icon = variant.icon;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2",
                variant.className,
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", variant.iconClassName)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
              >
                <XIcon />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return toast;
}
