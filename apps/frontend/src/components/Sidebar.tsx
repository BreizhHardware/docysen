import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  to: string;
  icon: ReactElement;
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-5 w-5 shrink-0"
    >
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Items visibles par tous
const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    to: "/",
    icon: (
      <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    ),
  },
  {
    label: "Documents",
    to: "/documents",
    icon: (
      <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    ),
  },
  { label: "Déposer un document", to: "/documents/new", icon: <Icon d="M12 4v16m8-8H4" /> },
  {
    label: "Modération",
    to: "/moderation",
    icon: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    label: "Recherche",
    to: "/search",
    icon: <Icon d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />,
  },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-slate-200">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/docysen_logo.png" alt="Docysen" className="h-8 w-8 rounded-md object-contain" />
        <span className="text-base font-semibold text-white">Docysen</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        {/* Lien Admin visible pour admin/modérateur uniquement */}
        {(user?.role === "admin" || user?.role === "moderator") && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
              }`
            }
          >
            <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            Administration
          </NavLink>
        )}
      </nav>

      {/* Profil + réglages en bas */}
      <div className="border-t border-white/10 px-3 py-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-sidebar-active text-white"
                : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
            }`
          }
        >
          {/* Avatar initiales */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : "Profil"}
            </p>
            <p className="text-[10px] text-slate-400">Réglages</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
