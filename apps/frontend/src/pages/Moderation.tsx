import type { SearchResult } from "@docysen/types";
import { useEffect, useState } from "react";

import DocumentPreviewModal from "../components/DocumentPreviewModal";
import DocumentThumbnail from "../components/DocumentThumbnail";
import { useAuth } from "../context/AuthContext";
import { approveDocument, getLikes, getModerationQueue, rejectDocument } from "../lib/api";

export default function Moderation() {
  const { token, user } = useAuth();
  const isModerator = user?.role === "admin" || user?.role === "moderator";

  const [queue, setQueue] = useState<SearchResult[]>([]);
  const [likedDocIds, setLikedDocIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Motif de rejet en cours de saisie par document (10-500 caractères, voir RejectDocumentSchema).
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!token || !isModerator) return;
    getModerationQueue(token)
      .then(setQueue)
      .catch(() => setError("Impossible de charger la file de modération."))
      .finally(() => setLoading(false));

    getLikes(token).then(({ likedDocumentIds }) => {
      setLikedDocIds(new Set(likedDocumentIds));
    });
  }, [token, isModerator]);

  async function handleApprove(id: string) {
    if (!token) return;
    setBusyId(id);
    setActionError(null);
    try {
      await approveDocument(token, id);
      setQueue((prev) => prev.filter((doc) => doc.id !== id));
    } catch {
      setActionError("Échec de l'approbation, réessaie.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    const reason = (reasons[id] ?? "").trim();
    if (reason.length < 10) {
      setActionError("Le motif de rejet doit faire au moins 10 caractères.");
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await rejectDocument(token, id, reason);
      setQueue((prev) => prev.filter((doc) => doc.id !== id));
    } catch {
      setActionError("Échec du rejet, réessaie.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isModerator) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">Accès réservé aux modérateurs et administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Modération</h1>
        <p className="text-sm text-slate-500">Documents en attente de modération.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {!loading && !error && queue.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Aucun document en attente.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {queue.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row"
          >
            <DocumentThumbnail
              title={doc.title}
              mimeType={doc.mimeType}
              thumbnailUrl={doc.thumbnailUrl}
              onClick={() => setPreviewing({ id: doc.id, title: doc.title })}
              className="sm:w-40 sm:shrink-0"
            />

            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{doc.title}</p>
                  <p className="text-sm text-slate-500">
                    {doc.subject} · {doc.docType} · {doc.promoLabel} {doc.semester} · déposé par{" "}
                    {doc.uploaderName}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(doc.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  placeholder="Motif de rejet (10 caractères min., requis pour rejeter)"
                  value={reasons[doc.id] ?? ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                  className="input flex-1"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => handleApprove(doc.id)}
                    className="bg-accent hover:bg-accent-hover rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => handleReject(doc.id)}
                    className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {previewing && (
        <DocumentPreviewModal
          documentId={previewing.id}
          title={previewing.title}
          likedDocIds={likedDocIds}
          setLikedDocIds={setLikedDocIds}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
