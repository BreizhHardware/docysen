import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { setNotificationEmail } from "../lib/api";

const ROLE_LABELS: Record<string, string> = {
  student: "Étudiant",
  moderator: "Modérateur",
  admin: "Administrateur",
};

export default function Settings() {
  const { user, token, logout } = useAuth();

  // État local de l'email de notification (peut diverger du JWT qui ne se rafraîchit pas sans re-login)
  const [notifEmail, setNotifEmail] = useState(user?.notificationEmail ?? "");
  const [notifEnabled, setNotifEnabled] = useState(user?.notificationEmail != null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSaveNotif(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      if (notifEnabled) {
        await setNotificationEmail(token, { optIn: true, email: notifEmail });
      } else {
        await setNotificationEmail(token, { optIn: false });
      }
      setSaveStatus("success");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Réglages</h1>
        <p className="text-sm text-slate-500">Gère ton compte et tes préférences.</p>
      </div>

      {/* Informations du compte */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Informations du compte</h2>
        </div>
        <div className="divide-y divide-slate-100">
          <Row label="Prénom" value={user?.firstName ?? "—"} />
          <Row label="Nom" value={user?.lastName ?? "—"} />
          <Row label="Email ISEN" value={user?.email ?? "—"} />
          <Row label="Identifiant Aurion" value={user?.userId ?? "—"} mono />
          <Row label="Rôle" value={ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "—"} />
        </div>
        <p className="px-6 py-3 text-xs text-slate-400">
          Ces informations sont issues de WebAurion et ne peuvent pas être modifiées ici.
        </p>
      </section>

      {/* Notifications par email */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700">Notifications par email</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Reçois un email uniquement en cas de rejet d'un document que tu as déposé.
          </p>
        </div>
        <form onSubmit={handleSaveNotif} className="flex flex-col gap-4 px-6 py-5">
          {/* Toggle opt-in */}
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={notifEnabled}
                onChange={(e) => {
                  setNotifEnabled(e.target.checked);
                  setSaveStatus("idle");
                }}
              />
              <div
                className={`h-5 w-9 rounded-full transition ${notifEnabled ? "bg-accent" : "bg-slate-300"}`}
              />
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notifEnabled ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-sm text-slate-700">
              {notifEnabled ? "Notifications activées" : "Notifications désactivées"}
            </span>
          </label>

          {/* Champ email (affiché uniquement si opt-in) */}
          {notifEnabled && (
            <div>
              <label
                htmlFor="notif-email"
                className="mb-1 block text-sm font-medium text-slate-600"
              >
                Adresse email de notification
              </label>
              <input
                id="notif-email"
                type="email"
                required
                value={notifEmail}
                onChange={(e) => {
                  setNotifEmail(e.target.value);
                  setSaveStatus("idle");
                }}
                className="input"
                placeholder="mon@email.com"
              />
            </div>
          )}

          {saveStatus === "success" && (
            <p className="text-sm text-emerald-600">✓ Préférences enregistrées.</p>
          )}
          {saveStatus === "error" && (
            <p className="text-sm text-red-600">Impossible d'enregistrer. Réessaie plus tard.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-red-700">Session</h2>
        </div>
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-slate-700">Se déconnecter</p>
            <p className="text-xs text-slate-400">Ferme la session en cours sur cet appareil.</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Se déconnecter
          </button>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
