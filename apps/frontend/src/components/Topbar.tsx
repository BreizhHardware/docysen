import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="relative w-full max-w-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          type="search"
          placeholder="Rechercher un document…"
          className="w-full rounded-md border border-slate-200 bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-xs font-semibold text-accent-hover">
            {initials}
          </span>
          <span className="hidden text-slate-700 sm:inline">
            {user?.firstName} {user?.lastName}
          </span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-slate-400">{user?.email}</div>
            <button
              onClick={logout}
              className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-surface"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
