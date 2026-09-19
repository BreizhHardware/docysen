import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "";

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-6">
      {/* Bouton tiroir, mobile uniquement */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Ouvrir le menu"
        className="hover:bg-surface shrink-0 rounded-md p-2 text-slate-500 lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="h-5 w-5"
        >
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1 sm:max-w-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un document…"
          className="bg-surface focus:border-accent focus:ring-accent w-full rounded-md border border-slate-200 py-2 pr-3 pl-9 text-sm outline-none focus:ring-1"
        />
      </form>

      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="hover:bg-surface flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        >
          <span className="bg-accent-light text-accent-hover flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
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
              className="hover:bg-surface block w-full px-3 py-2 text-left text-sm text-slate-600"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
