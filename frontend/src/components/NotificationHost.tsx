import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, formatApiError } from "@/lib/api";
import {
  productionIdFromPath,
  routeKeyFromPath,
  SEVERITY_BANNER_CLASSES,
} from "@/lib/notifications";
import type { AnnouncementCtaResponse, NotificationInboxItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type InboxState = {
  unread_count: number;
  items: NotificationInboxItem[];
  active_banner: NotificationInboxItem | null;
  pending_modal: NotificationInboxItem | null;
};

const MODAL_ACCENT_CLASSES: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  urgent: "bg-destructive",
};

type NotificationContextValue = {
  inbox: InboxState | null;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notificationId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("Notification components must be used within NotificationProvider");
  }
  return ctx;
}

function formatPostedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function CtaButtons({
  ctas,
  onNavigate,
  className,
}: {
  ctas: AnnouncementCtaResponse[];
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  if (ctas.length === 0) return null;

  return (
    <div className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {ctas.map((cta) => {
        if (cta.kind === "external") {
          return (
            <Button
              key={cta.id}
              size="sm"
              variant={cta.style === "primary" ? "default" : "outline"}
              asChild
            >
              <a href={cta.target} target="_blank" rel="noopener noreferrer">
                {cta.label}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          );
        }
        return (
          <Button
            key={cta.id}
            type="button"
            size="sm"
            variant={cta.style === "primary" ? "default" : "outline"}
            onClick={() => {
              onNavigate?.();
              void navigate(cta.target);
            }}
          >
            {cta.label}
          </Button>
        );
      })}
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [inbox, setInbox] = useState<InboxState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const productionId = productionIdFromPath(location.pathname);
  const routeKey = routeKeyFromPath(location.pathname, location.search);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getNotificationInbox({
        productionId: productionId ?? undefined,
        routeKey: routeKey ?? undefined,
      });
      setInbox(data);
      setError(null);
    } catch (err) {
      setError(formatApiError(err, "Could not load notifications"));
    }
  }, [productionId, routeKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const markRead = useCallback(
    async (notificationId: number) => {
      try {
        await api.markNotificationRead(notificationId);
        await refresh();
      } catch (err) {
        setError(formatApiError(err, "Could not mark notification read"));
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      await refresh();
    } catch (err) {
      setError(formatApiError(err, "Could not mark all read"));
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ inbox, error, refresh, markRead, markAllRead }),
    [inbox, error, refresh, markRead, markAllRead],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { inbox, error, markRead, markAllRead } = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const unreadCount = inbox?.unread_count ?? 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        onClick={() => setPanelOpen((open) => !open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {badgeLabel}
          </span>
        )}
      </Button>

      {panelOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            aria-label="Close notifications"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-medium">Notifications</h2>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </Button>
              )}
            </div>
            {error && (
              <p className="border-b border-border px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <ul className="max-h-96 overflow-y-auto">
              {!inbox || inbox.items.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  You&apos;re all caught up
                </li>
              ) : (
                inbox.items.map((item) => {
                  const unread = item.read_at == null;
                  const expanded = expandedId === item.id;
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        unread && "bg-muted/40",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full flex-col items-stretch justify-start gap-0 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/60"
                        onClick={() => {
                          setExpandedId(expanded ? null : item.id);
                          if (unread) void markRead(item.id);
                        }}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{item.title}</p>
                          {unread && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.production_title
                            ? `${item.production_title} · `
                            : item.kind === "system"
                              ? "System · "
                              : "Org-wide · "}
                          {formatPostedAt(item.created_at)}
                        </p>
                        {expanded && item.body && (
                          <p className="mt-2 w-full whitespace-pre-wrap text-sm text-muted-foreground">
                            {item.body}
                          </p>
                        )}
                      </Button>
                      {expanded && (
                        <div className="px-3 pb-3">
                          <CtaButtons
                            ctas={item.ctas}
                            onNavigate={() => setPanelOpen(false)}
                          />
                          {item.deep_link && item.ctas.length === 0 && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="mt-2 h-auto p-0"
                              onClick={() => {
                                setPanelOpen(false);
                                void navigate(item.deep_link!);
                              }}
                            >
                              Open
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export function NotificationBanner() {
  const { inbox, markRead } = useNotifications();
  const banner = inbox?.active_banner ?? null;
  if (!banner) return null;

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5",
        SEVERITY_BANNER_CLASSES[banner.severity ?? "info"] ?? SEVERITY_BANNER_CLASSES.info,
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{banner.title}</p>
          {banner.body && (
            <p className="mt-0.5 whitespace-pre-wrap text-sm opacity-90">{banner.body}</p>
          )}
          <CtaButtons ctas={banner.ctas} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 bg-background/60"
          onClick={() => void markRead(banner.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function NotificationModal() {
  const { inbox, markRead } = useNotifications();
  const modal = inbox?.pending_modal ?? null;
  const severity = modal?.severity ?? "info";

  return (
    <Dialog
      open={modal != null}
      onOpenChange={(open) => {
        if (!open && modal) void markRead(modal.id);
      }}
    >
      {modal && (
        <DialogContent
          showCloseButton
          className="inset-auto left-1/2 top-1/2 m-0 flex h-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden p-0"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div
            className={cn(
              "h-2 w-full shrink-0",
              MODAL_ACCENT_CLASSES[severity] ?? MODAL_ACCENT_CLASSES.info,
            )}
            aria-hidden="true"
          />
          <div className="overflow-y-auto overscroll-contain max-h-[calc(100vh-7.5rem)]">
            <div className="space-y-5 p-6 pb-5">
              <DialogHeader className="items-center text-center sm:text-center">
                <DialogTitle className="text-2xl leading-tight">{modal.title}</DialogTitle>
                {modal.body && (
                  <DialogDescription className="whitespace-pre-wrap text-center text-base leading-relaxed text-foreground/80">
                    {modal.body}
                  </DialogDescription>
                )}
              </DialogHeader>
              <CtaButtons
                ctas={modal.ctas}
                onNavigate={() => void markRead(modal.id)}
                className="justify-center"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/60 p-6 pt-5 sm:justify-center">
            <Button type="button" onClick={() => void markRead(modal.id)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
