import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import ActAsDialog from "@/components/ActAsDialog";
import FeedbackDialog from "@/components/FeedbackDialog";
import {
  NotificationBanner,
  NotificationBell,
  NotificationModal,
  NotificationProvider,
} from "@/components/NotificationHost";
import ThemeToggle from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, formatApiError } from "@/lib/api";
import { getLastProduction, rememberLastProduction } from "@/lib/lastProduction";
import { readSessionNavOpen, writeSessionNavOpen } from "@/lib/sessionNavOpen";
import { humanTimelinePath } from "@/lib/timelineDeepLinks";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2 text-sm font-medium outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

const sectionSummaryClass =
  "flex cursor-pointer list-none items-center gap-1 rounded-md pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground outline-none marker:content-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden";

export default function AppShell() {
  return (
    <NotificationProvider>
      <AppShellInner />
    </NotificationProvider>
  );
}

function CollapsibleNavSection({
  storageKey,
  defaultOpen,
  title,
  children,
}: {
  storageKey: string;
  defaultOpen: boolean;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readSessionNavOpen(storageKey, defaultOpen));

  return (
    <details
      className="group"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        writeSessionNavOpen(storageKey, next);
      }}
    >
      <summary className={sectionSummaryClass}>
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden
        />
        {title}
      </summary>
      <div className="space-y-1">{children}</div>
    </details>
  );
}

function AppShellInner() {
  const {
    user,
    logout,
    isAdmin,
    canManagePreparation,
    isActorOnly,
    isImpersonating,
    impersonation,
    stopActAs,
  } = useAuth();
  const toast = useToast();
  const { id: productionId } = useParams();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [productionHasScript, setProductionHasScript] = useState(true);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [actAsOpen, setActAsOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const [bookmarks, setBookmarks] = useState<
    Awaited<ReturnType<typeof api.listBookmarks>>
  >([]);

  const lastProduction = useMemo(() => getLastProduction(), [location.pathname, productionId]);
  const showBackToProduction =
    !productionId &&
    lastProduction !== null &&
    (location.pathname === "/users" || location.pathname === "/settings");

  const displayProductionTitle = productionTitle ?? (productionId ? `Production #${productionId}` : null);

  useEffect(() => {
    if (!productionId) {
      setProductionTitle(null);
      setProductionHasScript(true);
      return;
    }

    void api
      .getProduction(Number(productionId))
      .then((production) => {
        setProductionTitle(production.title);
        setProductionHasScript(Boolean(production.author));
        rememberLastProduction(Number(productionId), production.title);
      })
      .catch(() => {
        setProductionTitle(null);
        setProductionHasScript(true);
      });
  }, [productionId]);

  useEffect(() => {
    if (!bookmarksOpen) return;
    void api.listBookmarks().then(setBookmarks).catch(() => setBookmarks([]));
  }, [bookmarksOpen]);

  async function handleStopActAs() {
    setReturning(true);
    try {
      await stopActAs();
      toast.success("Returned to your admin account.");
    } catch (err) {
      toast.error(formatApiError(err, "Could not return to admin."));
    } finally {
      setReturning(false);
    }
  }

  const preparationLinks = productionId ? (
    <>
      <NavLink
        to={`/productions/${productionId}/characters`}
        className={navLinkClass}
        onClick={() => setSidebarOpen(false)}
      >
        Characters
      </NavLink>
      <NavLink
        to={`/productions/${productionId}/songs`}
        className={navLinkClass}
        onClick={() => setSidebarOpen(false)}
      >
        Songs
      </NavLink>
      <NavLink
        to={`/productions/${productionId}/props`}
        className={navLinkClass}
        onClick={() => setSidebarOpen(false)}
      >
        Props
      </NavLink>
      <NavLink
        to={`/productions/${productionId}/costumes`}
        className={navLinkClass}
        onClick={() => setSidebarOpen(false)}
      >
        Costumes
      </NavLink>
      {canManagePreparation && (
        <NavLink
          to={`/productions/${productionId}/lav-chart`}
          className={navLinkClass}
          onClick={() => setSidebarOpen(false)}
        >
          Lav chart
        </NavLink>
      )}
      <NavLink
        to={`/productions/${productionId}/set-pieces`}
        className={navLinkClass}
        onClick={() => setSidebarOpen(false)}
      >
        Set Pieces
      </NavLink>
      {canManagePreparation && (
        <>
          <NavLink
            to={`/productions/${productionId}/groups`}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Groups
          </NavLink>
          <NavLink
            to={`/productions/${productionId}/cue-categories`}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            Cue Categories
          </NavLink>
        </>
      )}
    </>
  ) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-[3px] focus:ring-ring/50"
      >
        Skip to content
      </a>

      <header className="app-shell-header flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground md:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          <Link to="/productions" className="shrink-0 text-lg font-semibold tracking-tight">
            The Theater Thing
          </Link>
          {productionId && displayProductionTitle && (
            <>
              <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                /
              </span>
              <span
                className="hidden max-w-[12rem] truncate text-sm font-semibold sm:inline md:max-w-xs"
                title={displayProductionTitle}
              >
                {displayProductionTitle}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 px-3 font-normal"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>
                {user?.first_name} {user?.last_name}
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                {user?.roles.map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px] font-normal">
                    {role}
                  </Badge>
                ))}
              </span>
            </Button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card py-1 shadow-md">
                  <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    @{user?.username}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
                    onClick={() => {
                      setMenuOpen(false);
                      setBookmarksOpen((open) => !open);
                    }}
                  >
                    My bookmarks
                  </Button>
                  {isAdmin && !isImpersonating && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
                      onClick={() => {
                        setMenuOpen(false);
                        setActAsOpen(true);
                      }}
                    >
                      Act as user…
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
                    asChild
                  >
                    <Link to="/about" onClick={() => setMenuOpen(false)}>
                      About the App
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
                    onClick={() => {
                      setMenuOpen(false);
                      setFeedbackOpen(true);
                    }}
                  >
                    Send feedback
                  </Button>
                  <div className="border-t border-border px-3 py-2">
                    <ThemeToggle compact />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-none px-3 py-2 font-normal"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    Log out
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {isImpersonating && impersonation && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm"
          role="status"
        >
          <p>
            Acting as{" "}
            <span className="font-medium">
              {user?.first_name} {user?.last_name}
            </span>{" "}
            <span className="text-muted-foreground">(@{user?.username})</span>
            {user?.roles?.length ? (
              <span className="text-muted-foreground">
                {" "}
                — {user.roles.join(", ")}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {" "}
              · return to {impersonation.original_first_name}{" "}
              {impersonation.original_last_name}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-warning/50 bg-background"
            disabled={returning}
            onClick={() => void handleStopActAs()}
          >
            {returning ? "Returning…" : "Return to admin"}
          </Button>
        </div>
      )}

      <NotificationBanner />

      {bookmarksOpen && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">My bookmarks</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBookmarksOpen(false)}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              Close
            </Button>
          </div>
          {bookmarks.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No bookmarks yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="text-sm">
                  <Link
                    to={humanTimelinePath(
                      bookmark.production_id,
                      bookmark.act_number,
                      bookmark.scene_number,
                      bookmark.sequence_number,
                    )}
                    className="font-medium hover:underline"
                    onClick={() => setBookmarksOpen(false)}
                  >
                    {bookmark.production_title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    —{" "}
                    {`${bookmark.act_number}.${bookmark.scene_number}.${bookmark.sequence_number}`}
                    {bookmark.label ? ` (${bookmark.label})` : ""}
                  </span>
                  <p className="truncate text-xs text-muted-foreground">
                    {bookmark.moment_preview}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "app-shell-sidebar w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3",
            "fixed inset-y-14 left-0 z-30 transition-transform md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="space-y-1">
            <NavLink to="/productions" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
              Productions
            </NavLink>
            <NavLink to="/about" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
              About the App
            </NavLink>

            {showBackToProduction && lastProduction && (
              <NavLink
                to={`/productions/${lastProduction.id}`}
                className={navLinkClass}
                onClick={() => setSidebarOpen(false)}
              >
                Back to {lastProduction.title ?? `Production #${lastProduction.id}`}
              </NavLink>
            )}

            {productionId && (
              <>
                <div className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Production
                </div>
                <NavLink
                  to={`/productions/${productionId}`}
                  end
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Overview
                </NavLink>
                <NavLink
                  to={`/productions/${productionId}/rehearse`}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Rehearse
                </NavLink>
                <NavLink
                  to={`/productions/${productionId}/rehearsals`}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Rehearsals
                </NavLink>
                <NavLink
                  to={`/productions/${productionId}/timeline`}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Timeline
                </NavLink>
                {isAdmin && !productionHasScript && (
                  <NavLink
                    to={`/productions/${productionId}/import`}
                    className={navLinkClass}
                    onClick={() => setSidebarOpen(false)}
                  >
                    Import script
                  </NavLink>
                )}

                <CollapsibleNavSection
                  storageKey="nav.preparation.open"
                  defaultOpen={!isActorOnly}
                  title="Preparation"
                >
                  {preparationLinks}
                </CollapsibleNavSection>

                {canManagePreparation && (
                  <CollapsibleNavSection
                    storageKey="nav.reports.open"
                    defaultOpen
                    title="Reports"
                  >
                    <NavLink
                      to={`/productions/${productionId}/reports`}
                      className={navLinkClass}
                      onClick={() => setSidebarOpen(false)}
                    >
                      Reports
                    </NavLink>
                  </CollapsibleNavSection>
                )}
              </>
            )}

            {isAdmin && (
              <>
                <div className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Administration
                </div>
                <NavLink to="/users" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                  User Management
                </NavLink>
                <NavLink
                  to="/settings"
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  App Settings
                </NavLink>
              </>
            )}
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="app-shell-overlay fixed inset-0 z-20 bg-black/30 md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main
          id="main-content"
          className="flex min-h-0 flex-1 flex-col overflow-auto px-3 pt-3 md:px-4 md:pt-4"
        >
          <div className="flex min-h-0 flex-1 flex-col pb-3 md:pb-4">
            <Outlet />
          </div>
        </main>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <ActAsDialog open={actAsOpen} onOpenChange={setActAsOpen} />
      <NotificationModal />
    </div>
  );
}
