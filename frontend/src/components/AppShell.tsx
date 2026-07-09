import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

export default function AppShell() {
  const { user, logout, isAdmin, canManagePreparation } = useAuth();
  const { id: productionId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [productionTitle, setProductionTitle] = useState<string | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<
    Awaited<ReturnType<typeof api.listBookmarks>>
  >([]);

  useEffect(() => {
    if (!productionId) {
      setProductionTitle(null);
      return;
    }

    void api
      .getProduction(Number(productionId))
      .then((production) => setProductionTitle(production.title))
      .catch(() => setProductionTitle(null));
  }, [productionId]);

  useEffect(() => {
    if (!bookmarksOpen) return;
    void api.listBookmarks().then(setBookmarks).catch(() => setBookmarks([]));
  }, [bookmarksOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/productions" className="text-lg font-semibold tracking-tight">
            Theater App
          </Link>
          {productionId && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {productionTitle ?? `Production #${productionId}`}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-muted"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span>
              {user?.first_name} {user?.last_name}
            </span>
            <span className="text-muted-foreground">({user?.roles.join(", ")})</span>
          </button>
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
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    setBookmarksOpen((open) => !open);
                  }}
                >
                  My bookmarks
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {bookmarksOpen && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">My bookmarks</h2>
            <button
              type="button"
              onClick={() => setBookmarksOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          {bookmarks.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No bookmarks yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="text-sm">
                  <Link
                    to={`/productions/${bookmark.production_id}/timeline`}
                    className="font-medium hover:underline"
                    onClick={() => setBookmarksOpen(false)}
                  >
                    {bookmark.production_title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — Moment {bookmark.sequence_number}
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

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "w-56 shrink-0 border-r border-border bg-card p-4",
            "fixed inset-y-14 left-0 z-30 transition-transform md:static md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="space-y-1">
            <NavLink to="/productions" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
              Productions
            </NavLink>

            {productionId && (
              <>
                <div className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Production
                </div>
                <NavLink
                  to={`/productions/${productionId}/timeline`}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Timeline
                </NavLink>

                <div className="pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Preparation
                </div>
                <NavLink
                  to={`/productions/${productionId}/characters`}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  Characters
                </NavLink>
                {canManagePreparation && (
                  <NavLink
                    to={`/productions/${productionId}/groups`}
                    className={navLinkClass}
                    onClick={() => setSidebarOpen(false)}
                  >
                    Groups
                  </NavLink>
                )}
              </>
            )}

            {isAdmin && (
              <NavLink to="/users" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                User Management
              </NavLink>
            )}
          </nav>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
