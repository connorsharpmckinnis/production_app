import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BrickWall,
  Calendar,
  ChartArea,
  ChevronRight,
  Drama,
  FileUp,
  Info,
  LayoutDashboard,
  Shapes,
  Mic,
  Music,
  PanelLeft,
  PanelLeftClose,
  Scroll,
  Settings,
  Shirt,
  Spotlight,
  Swords,
  User,
  UserRoundCog,
  UsersRound,
  VenetianMask,
  X,
  type LucideIcon,
} from "lucide-react";
import ActAsDialog from "@/components/ActAsDialog";
import { AppMark } from "@/components/AppMark";
import FeedbackDialog from "@/components/FeedbackDialog";
import {
  NotificationBanner,
  NotificationBell,
  NotificationModal,
  NotificationProvider,
} from "@/components/NotificationHost";
import ObjectDetailHost from "@/components/object-detail/ObjectDetailHost";
import ThemeToggle from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { ObjectDetailProvider } from "@/context/ObjectDetailContext";
import {
  ProductionAccessProvider,
  useProductionAccess,
} from "@/context/ProductionAccessContext";
import { useToast } from "@/context/ToastContext";
import { useIsMediumScreen } from "@/hooks/useIsMediumScreen";
import { api, formatApiError } from "@/lib/api";
import { getLastProduction, rememberLastProduction } from "@/lib/lastProduction";
import { readSessionNavOpen, writeSessionNavOpen } from "@/lib/sessionNavOpen";
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "@/lib/sidebarCollapsed";
import { humanTimelinePath } from "@/lib/timelineDeepLinks";
import { cn } from "@/lib/utils";

const NAV_ICON_CLASS = "size-5 shrink-0";

function SidebarNavLink({
  to,
  end,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={label}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring",
          collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <Icon className={NAV_ICON_CLASS} strokeWidth={2} aria-hidden />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

function SidebarSectionLabel({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="my-2 border-t border-border" role="separator" aria-label={label} />;
  }
  return (
    <div className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  );
}

const sectionSummaryClass =
  "flex cursor-pointer list-none items-center gap-1 rounded-md pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground outline-none marker:content-none focus-visible:ring-1 focus-visible:ring-ring [&::-webkit-details-marker]:hidden";

export default function AppShell() {
  return (
    <NotificationProvider>
      <ProductionAccessProvider>
        <ObjectDetailProvider>
          <AppShellInner />
        </ObjectDetailProvider>
      </ProductionAccessProvider>
    </NotificationProvider>
  );
}

function CollapsibleNavSection({
  storageKey,
  defaultOpen,
  title,
  collapsed,
  children,
}: {
  storageKey: string;
  defaultOpen: boolean;
  title: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readSessionNavOpen(storageKey, defaultOpen));

  if (collapsed) {
    return <div className="space-y-1">{children}</div>;
  }

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
    isImpersonating,
    impersonation,
    stopActAs,
  } = useAuth();
  const { access, hasCapability } = useProductionAccess();
  const toast = useToast();
  const { id: productionId } = useParams();
  const location = useLocation();
  const isMediumScreen = useIsMediumScreen();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsed(false));
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
  const canRead = (resource: string) => hasCapability(resource, "read");
  const isScopedActorOnly =
    Boolean(access?.role_codes.includes("actor")) &&
    !access?.role_codes.includes("director") &&
    !isAdmin;
  // Icon-only rail on desktop when collapsed; mobile drawer always shows labels.
  const navCollapsed = sidebarCollapsed && isMediumScreen;

  function closeMobileNav() {
    setSidebarOpen(false);
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }

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
        setProductionHasScript(production.has_imported_script);
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
      {canRead("people") && (
        <SidebarNavLink
          to={`/productions/${productionId}/people`}
          label="People"
          icon={UsersRound}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("characters") && (
        <SidebarNavLink
          to={`/productions/${productionId}/characters`}
          label="Characters"
          icon={VenetianMask}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("songs") && (
        <SidebarNavLink
          to={`/productions/${productionId}/songs`}
          label="Songs"
          icon={Music}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("props") && (
        <SidebarNavLink
          to={`/productions/${productionId}/props`}
          label="Props"
          icon={Swords}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("costumes") && (
        <SidebarNavLink
          to={`/productions/${productionId}/costumes`}
          label="Costumes"
          icon={Shirt}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("lav_chart") && (
        <SidebarNavLink
          to={`/productions/${productionId}/lav-chart`}
          label="Lav chart"
          icon={Mic}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {canRead("set_pieces") && (
        <SidebarNavLink
          to={`/productions/${productionId}/set-pieces`}
          label="Set Pieces"
          icon={BrickWall}
          collapsed={navCollapsed}
          onNavigate={closeMobileNav}
        />
      )}
      {(canRead("groups") || canRead("cue_categories")) && (
        <>
          {canRead("groups") && (
            <SidebarNavLink
              to={`/productions/${productionId}/groups`}
              label="Groups"
              icon={Shapes}
              collapsed={navCollapsed}
              onNavigate={closeMobileNav}
            />
          )}
          {canRead("cue_categories") && (
            <SidebarNavLink
              to={`/productions/${productionId}/cue-categories`}
              label="Cue Categories"
              icon={Spotlight}
              collapsed={navCollapsed}
              onNavigate={closeMobileNav}
            />
          )}
        </>
      )}
    </>
  ) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        Skip to content
      </a>

      <header className="app-shell-header relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground md:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </Button>
          <Link
            to="/productions"
            className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <AppMark className="h-6 w-6 shrink-0" />
            <span className="truncate">The Theater Thing</span>
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

        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 px-2 font-normal md:px-3"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Open account menu"
            >
              <User className="h-5 w-5 shrink-0 md:hidden" aria-hidden />
              <span className="hidden md:inline">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="hidden items-center gap-1 md:flex">
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
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card py-1">
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

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            className="app-shell-overlay fixed inset-0 top-14 z-30 bg-black/50 md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "app-shell-sidebar shrink-0 overflow-y-auto border-r border-border bg-card",
            "fixed inset-y-14 left-0 z-40 transition-[transform,width] md:static md:translate-x-0",
            navCollapsed ? "w-16 p-2" : "w-56 p-3",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Menu
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={closeMobileNav}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>

          <div
            className={cn(
              "mb-2 hidden md:flex",
              navCollapsed ? "justify-center" : "justify-end",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={toggleSidebarCollapsed}
              aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {navCollapsed ? (
                <PanelLeft className="size-5" strokeWidth={2} aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" strokeWidth={2} aria-hidden />
              )}
            </Button>
          </div>

          <nav className="space-y-1">
            <SidebarNavLink
              to="/productions"
              label="Productions"
              icon={Drama}
              collapsed={navCollapsed}
              onNavigate={closeMobileNav}
            />
            <SidebarNavLink
              to="/about"
              label="About"
              icon={Info}
              collapsed={navCollapsed}
              onNavigate={closeMobileNav}
            />

            {showBackToProduction && lastProduction && (
              <SidebarNavLink
                to={`/productions/${lastProduction.id}`}
                label={`Back to ${lastProduction.title ?? `Production #${lastProduction.id}`}`}
                icon={ArrowLeft}
                collapsed={navCollapsed}
                onNavigate={closeMobileNav}
              />
            )}

            {productionId && (
              <>
                <SidebarSectionLabel label="Production" collapsed={navCollapsed} />
                {canRead("overview") && (
                  <SidebarNavLink
                    to={`/productions/${productionId}`}
                    end
                    label="Overview"
                    icon={LayoutDashboard}
                    collapsed={navCollapsed}
                    onNavigate={closeMobileNav}
                  />
                )}
                {canRead("timeline") && (
                  <SidebarNavLink
                    to={`/productions/${productionId}/timeline`}
                    label="Timeline"
                    icon={Scroll}
                    collapsed={navCollapsed}
                    onNavigate={closeMobileNav}
                  />
                )}
                {canRead("rehearsals") && (
                  <SidebarNavLink
                    to={`/productions/${productionId}/rehearsals`}
                    label="Rehearsals"
                    icon={Calendar}
                    collapsed={navCollapsed}
                    onNavigate={closeMobileNav}
                  />
                )}
                {isAdmin && !productionHasScript && (
                  <SidebarNavLink
                    to={`/productions/${productionId}/import`}
                    label="Import script"
                    icon={FileUp}
                    collapsed={navCollapsed}
                    onNavigate={closeMobileNav}
                  />
                )}

                <CollapsibleNavSection
                  storageKey="nav.preparation.open"
                  defaultOpen={!isScopedActorOnly}
                  title="Preparation"
                  collapsed={navCollapsed}
                >
                  {preparationLinks}
                </CollapsibleNavSection>

                {canRead("reports") && (
                  <CollapsibleNavSection
                    storageKey="nav.reports.open"
                    defaultOpen
                    title="Reports"
                    collapsed={navCollapsed}
                  >
                    <SidebarNavLink
                      to={`/productions/${productionId}/reports`}
                      label="Reports"
                      icon={ChartArea}
                      collapsed={navCollapsed}
                      onNavigate={closeMobileNav}
                    />
                  </CollapsibleNavSection>
                )}
              </>
            )}

            {isAdmin && (
              <>
                <SidebarSectionLabel label="Administration" collapsed={navCollapsed} />
                <SidebarNavLink
                  to="/users"
                  label="User Management"
                  icon={UserRoundCog}
                  collapsed={navCollapsed}
                  onNavigate={closeMobileNav}
                />
                <SidebarNavLink
                  to="/settings"
                  label="App Settings"
                  icon={Settings}
                  collapsed={navCollapsed}
                  onNavigate={closeMobileNav}
                />
              </>
            )}
          </nav>
        </aside>

        <main
          id="main-content"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pt-3 md:px-4 md:pt-4"
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col pb-6 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <ActAsDialog open={actAsOpen} onOpenChange={setActAsOpen} />
      <NotificationModal />
      <ObjectDetailHost />
    </div>
  );
}
