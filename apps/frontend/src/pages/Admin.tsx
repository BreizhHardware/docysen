import { FormEvent, useEffect, useState, useCallback } from "react";
import type { PromoSummary, UserRole, UserSummary } from "@docysen/types";
import { useAuth } from "../context/AuthContext";
import {
  changeUserRole,
  deletePromo,
  getAdminOverview,
  getAdminUsers,
  getPromos,
  updatePromo,
} from "../lib/api";
import { ApiError } from "../lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Étudiant",
  moderator: "Modérateur",
  admin: "Administrateur",
};

const ROLE_BADGE: Record<UserRole, string> = {
  student: "bg-slate-100 text-slate-700",
  moderator: "bg-blue-100 text-blue-700",
  admin: "bg-violet-100 text-violet-700",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

// ── Onglets ───────────────────────────────────────────────────────────────────

type Tab = "overview" | "promos" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "promos", label: "Promotions" },
  { id: "users", label: "Utilisateurs" },
];

// ── Vue d'ensemble ─────────────────────────────────────────────────────────────

function Overview({ token }: { token: string }) {
  const [data, setData] = useState<{
    byStatus: Record<string, number>;
    totalStorageBytes: number;
  } | null>(null);

  useEffect(() => {
    getAdminOverview(token).then(setData);
  }, [token]);

  if (!data) return <p className="text-sm text-slate-400">Chargement…</p>;

  const rows = [
    { label: "Documents approuvés", value: data.byStatus.approved ?? 0, color: "text-emerald-600" },
    {
      label: "En attente de modération",
      value: data.byStatus.pending ?? 0,
      color: "text-amber-600",
    },
    { label: "Documents rejetés", value: data.byStatus.rejected ?? 0, color: "text-red-500" },
    {
      label: "Stockage total",
      value: formatBytes(data.totalStorageBytes),
      color: "text-slate-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">{row.label}</p>
          <p className={`mt-2 text-2xl font-semibold ${row.color}`}>{row.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Promotions ────────────────────────────────────────────────────────────────

function PromoRow({
  promo,
  isAdmin,
  token,
  onUpdated,
  onDeleted,
}: {
  promo: PromoSummary;
  isAdmin: boolean;
  token: string;
  onUpdated: (p: PromoSummary) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(promo.label);
  const [semestersRaw, setSemestersRaw] = useState(promo.semesters.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const semesters = semestersRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (semesters.length === 0) {
        setError("Au moins un semestre requis");
        return;
      }
      const updated = await updatePromo(token, promo.id, {
        label: label.trim() || undefined,
        semesters,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer la promo « ${promo.label} » ?`)) return;
    try {
      await deletePromo(token, promo.id);
      onDeleted(promo.id);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Impossible de supprimer");
    }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={3} className="px-4 py-3">
          <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
            <input
              className="input w-48"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label promo"
              required
            />
            <input
              className="input flex-1"
              value={semestersRaw}
              onChange={(e) => setSemestersRaw(e.target.value)}
              placeholder="S1, S2, S3 …"
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-800">{promo.label}</td>
      <td className="px-4 py-3 text-slate-500">{promo.semesters.join(", ")}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
          >
            Modifier
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function Promos({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const [promos, setPromos] = useState<PromoSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSemesters, setNewSemesters] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    getPromos(token).then(setPromos);
  }, [token]);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setCreating(true);
      setCreateError(null);
      try {
        const semesters = newSemesters
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (semesters.length === 0) {
          setCreateError("Au moins un semestre requis");
          return;
        }
        // Réutilise createDocument côté API — non : on a besoin de POST /promos
        // On importe directement via fetch (pas de wrapper dédié pour la création de promo dans api.ts)
        const res = await fetch(
          `${import.meta.env.VITE_API_SERVICE_BASE_URL ?? "http://localhost:3002"}/promos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ label: newLabel.trim(), semesters }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => undefined);
          throw new Error(body?.error ?? `Erreur ${res.status}`);
        }
        const created: PromoSummary = await res.json();
        setPromos((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
        setNewLabel("");
        setNewSemesters("");
        setShowForm(false);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setCreating(false);
      }
    },
    [token, newLabel, newSemesters],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{promos.length} promotion(s)</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Nouvelle promo
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-accent/30 bg-accent/5 p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Label</label>
            <input
              className="input w-48"
              placeholder="ex : ISEN Ouest 2028"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Semestres (séparés par ,)</label>
            <input
              className="input w-56"
              placeholder="S1, S2, S3, S4, S5, S6"
              value={newSemesters}
              onChange={(e) => setNewSemesters(e.target.value)}
            />
          </div>
          {createError && <span className="text-xs text-red-600">{createError}</span>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {creating ? "Création…" : "Créer"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Semestres</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promos.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                  Aucune promo
                </td>
              </tr>
            ) : (
              promos.map((p) => (
                <PromoRow
                  key={p.id}
                  promo={p}
                  isAdmin={isAdmin}
                  token={token}
                  onUpdated={(updated) =>
                    setPromos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                  }
                  onDeleted={(id) => setPromos((prev) => prev.filter((x) => x.id !== id))}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Utilisateurs ──────────────────────────────────────────────────────────────

const ROLE_OPTIONS: UserRole[] = ["student", "moderator", "admin"];

function UserRow({
  u,
  token,
  currentUserId,
  onRoleChanged,
}: {
  u: UserSummary;
  token: string;
  currentUserId: string;
  onRoleChanged: (id: string, role: UserRole) => void;
}) {
  const [saving, setSaving] = useState(false);
  const isSelf = u.aurionId === currentUserId;

  async function handleRole(role: UserRole) {
    if (role === u.role) return;
    setSaving(true);
    try {
      await changeUserRole(token, u.id, role);
      onRoleChanged(u.id, role);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Impossible de changer le rôle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={isSelf ? "bg-slate-50/60" : undefined}>
      <td className="px-4 py-3 font-medium text-slate-800">
        {u.firstName} {u.lastName}
        {isSelf && <span className="ml-1.5 text-xs text-slate-400">(vous)</span>}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">{u.aurionId}</td>
      <td className="px-4 py-3 text-slate-500">{u.aurionEmail}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}
        >
          {ROLE_LABELS[u.role]}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-slate-500">{u.documentCount}</td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <select
            disabled={saving}
            value={u.role}
            onChange={(e) => handleRole(e.target.value as UserRole)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        )}
      </td>
    </tr>
  );
}

function Users({ token, currentUserId }: { token: string; currentUserId: string }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAdminUsers(token)
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.aurionId.toLowerCase().includes(q) ||
      u.aurionEmail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Rechercher un utilisateur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-sm text-slate-400">{filtered.length} résultat(s)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Identifiant Aurion</th>
              <th className="px-4 py-3">Email ISEN</th>
              <th className="px-4 py-3">Rôle actuel</th>
              <th className="px-4 py-3 text-center">Docs</th>
              <th className="px-4 py-3 text-right">Changer le rôle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  token={token}
                  currentUserId={currentUserId}
                  onRoleChanged={(id, role) =>
                    setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, role } : x)))
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function Admin() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  // Seuls admin/modérateur accèdent à cette page (garde côté frontend, enforced côté API)
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">Accès réservé aux administrateurs et modérateurs.</p>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Administration</h1>
        <p className="text-sm text-slate-500">Gestion des promos, des utilisateurs et vue d'ensemble.</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition
              ${tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === "overview" && <Overview token={token!} />}
      {tab === "promos" && <Promos token={token!} isAdmin={isAdmin} />}
      {tab === "users" && isAdmin && (
        <Users token={token!} currentUserId={user.userId} />
      )}
      {tab === "users" && !isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-amber-700">
            La gestion des utilisateurs est réservée aux administrateurs.
          </p>
        </div>
      )}
    </div>
  );
}
