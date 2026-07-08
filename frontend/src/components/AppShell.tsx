import { useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const { id: productionId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
              Production #{productionId}
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
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-md">
                <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  @{user?.username}
                </div>
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
