import { FormEvent, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { setNotificationEmail } from "../lib/api";

/**
 * Affichée une seule fois, à la première connexion. Consentement opt-in pour l'email de
 * notification (ex: rejet de document).
 */
export default function ConsentEmailModal() {
  const { token, user, dismissFirstLogin } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChoice(optIn: boolean) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (optIn) {
        await setNotificationEmail(token, { optIn: true, email });
      } else {
        await setNotificationEmail(token, { optIn: false });
      }
      dismissFirstLogin();
    } catch {
      setError(
        "Impossible d'enregistrer ton choix pour le moment. Réessaie plus tard depuis ton profil.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleChoice(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-800">
          Recevoir des notifications par email ?
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Si tu l'acceptes, Docysen t'enverra un email uniquement pour t'informer du rejet d'un
          document que tu as déposé, jamais pour autre chose, et tu peux changer d'avis à tout
          moment depuis ton profil.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <div>
            <label
              htmlFor="consent-email"
              className="mb-1 block text-sm font-medium text-slate-600"
            >
              Adresse email
            </label>
            <input
              id="consent-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={saving}
              className="bg-accent hover:bg-accent-hover flex-1 rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            >
              Enregistrer et activer
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleChoice(false)}
              className="hover:bg-surface flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition disabled:opacity-60"
            >
              Non merci
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
