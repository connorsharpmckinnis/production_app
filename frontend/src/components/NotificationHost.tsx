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
}: {
  ctas: AnnouncementCtaResponse[];
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  if (ctas.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ctas.map((cta) => {
        if (cta.kind === "external") {
          return (
            <a
              key={cta.id}
              href={cta.target}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium",
                cta.style === "primary"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted",
              )}
            >
              {cta.label}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          );
        }
        return (
          <button
            key={cta.id}
            type="button"
            className={cn(
              "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium",
              cta.style === "primary"
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted",
            )}
            onClick={() => {
              onNavigate?.();
              void navigate(cta.target);
            }}
          >
            {cta.label}
          </button>
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
  const routeKey = routeKeyFromPath(location.pathname);

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
      <button
        type="button"
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
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
      </button>

      {panelOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            aria-label="Close notifications"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute right-0 z-40 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card shadow-md">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-medium">Notifications</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </button>
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
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-muted/60"
                        onClick={() => {
                          setExpandedId(expanded ? null : item.id);
                          if (unread) void markRead(item.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
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
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {item.body}
                          </p>
                        )}
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3">
                          <CtaButtons
                            ctas={item.ctas}
                            onNavigate={() => setPanelOpen(false)}
                          />
                          {item.deep_link && item.ctas.length === 0 && (
                            <button
                              type="button"
                              className="mt-2 text-sm font-medium text-primary hover:underline"
                              onClick={() => {
                                setPanelOpen(false);
                                void navigate(item.deep_link!);
                              }}
                            >
                              Open
                            </button>
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
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{modal.title}</DialogTitle>
            {modal.body && (
              <DialogDescription className="whitespace-pre-wrap text-foreground/80">
                {modal.body}
              </DialogDescription>
            )}
          </DialogHeader>
          <CtaButtons ctas={modal.ctas} onNavigate={() => void markRead(modal.id)} />
          <DialogFooter>
            <Button type="button" onClick={() => void markRead(modal.id)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
