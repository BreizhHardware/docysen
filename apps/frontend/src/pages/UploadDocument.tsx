import { MAX_UPLOAD_SIZE_BYTES } from "@docysen/types";
import type { PromoSummary } from "@docysen/types";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useAuth } from "../context/AuthContext";
import { confirmUpload, createDocument, getPromos, uploadToPresignedUrl } from "../lib/api";

// Types de document ISEN courants ; jamais illustré/étendu automatiquement, une simple liste fixe suffit ici.
const DOC_TYPE_OPTIONS = [
  { value: "cours", label: "Cours" },
  { value: "td", label: "TD" },
  { value: "tp", label: "TP" },
  { value: "examen", label: "Examen" },
  { value: "corrige", label: "Corrigé" },
  { value: "autre", label: "Autre" },
];

const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024);

export default function UploadDocument() {
  const { token } = useAuth();

  const [promos, setPromos] = useState<PromoSummary[]>([]);
  const [promosError, setPromosError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [docType, setDocType] = useState(DOC_TYPE_OPTIONS[0]!.value);
  const [promoId, setPromoId] = useState("");
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPromos(token)
      .then(setPromos)
      .catch(() => setPromosError("Impossible de charger les promos. Réessaie plus tard."));
  }, [token]);

  const selectedPromo = promos.find((promo) => promo.id === promoId);

  // Pas de valeur par défaut devinée : promo/semestre doivent être choisis explicitement, la soumission reste bloquée sans ça.
  const canSubmit = Boolean(
    token && title && subject && docType && promoId && semester && file && !submitting,
  );

  function handlePromoChange(value: string) {
    setPromoId(value);
    setSemester("");
  }

  function handleFileChange(selected: File | null) {
    setError(null);
    if (selected && selected.size > MAX_UPLOAD_SIZE_BYTES) {
      setFile(null);
      setError(`Fichier trop volumineux (${MAX_UPLOAD_SIZE_MB} Mo max).`);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !file || !canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const { documentId, uploadUrl } = await createDocument(token, {
        title,
        subject,
        docType,
        promoId,
        semester,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      await uploadToPresignedUrl(uploadUrl, file);
      // Déclenche la génération de miniature : pas bloquant pour
      // l'utilisateur si ça échoue, le document reste utilisable sans miniature (fallback icône).
      confirmUpload(token, documentId).catch(() => {});
      setSuccess(true);
      setTitle("");
      setSubject("");
      setFile(null);
    } catch {
      setError("Le dépôt a échoué. Vérifie le fichier et réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Déposer un document</h1>
        <p className="text-sm text-slate-500">
          Renseigne ta promo et ton semestre toi-même : Docysen ne peut pas les déduire
          automatiquement de ta connexion.
        </p>
      </div>

      {promosError && <p className="text-sm text-red-600">{promosError}</p>}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <Field label="Titre">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="ex: TD1 - Algèbre linéaire"
          />
        </Field>

        <Field label="Matière">
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            placeholder="ex: Mathématiques"
          />
        </Field>

        <Field label="Type de document">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input">
            {DOC_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Promo">
          <select
            required
            value={promoId}
            onChange={(e) => handlePromoChange(e.target.value)}
            className="input"
          >
            <option value="" disabled>
              Sélectionner une promo
            </option>
            {promos.map((promo) => (
              <option key={promo.id} value={promo.id}>
                {promo.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Semestre">
          <select
            required
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={!selectedPromo}
            className="input disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="" disabled>
              {selectedPromo ? "Sélectionner un semestre" : "Choisis d'abord une promo"}
            </option>
            {selectedPromo?.semesters.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
        </Field>

        <Field label={`Fichier (${MAX_UPLOAD_SIZE_MB} Mo max)`}>
          <input
            required
            type="file"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="file:bg-accent-light file:text-accent hover:file:bg-accent-light/80 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-accent text-sm">Document déposé, en attente de modération.</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-accent hover:bg-accent-hover mt-2 rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Envoi en cours..." : "Déposer"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}
