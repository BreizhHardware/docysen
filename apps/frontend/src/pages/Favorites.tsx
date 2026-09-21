import type { SearchResult } from "@docysen/types";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import DocumentPreviewModal from "../components/DocumentPreviewModal";
import DocumentThumbnail from "../components/DocumentThumbnail";
import LikeButton from "../components/LikeButton";
import { useAuth } from "../context/AuthContext";
import { getLikes, searchDocuments, toggleDocumentLike, toggleSubjectFavorite } from "../lib/api";

// Aperçu par matière favorite : au-delà, direction Recherche pour voir le reste.
const SUBJECT_PREVIEW_LIMIT = 6;

function DocumentGrid({
  documents,
  likedDocIds,
  onToggleLike,
  onPreview,
  onSubjectClick,
}: {
  documents: SearchResult[];
  likedDocIds: Set<string>;
  onToggleLike: (docId: string) => void;
  onPreview: (doc: { id: string; title: string }) => void;
  onSubjectClick: (subject: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {documents.map((doc) => (
        <div key={doc.id} className="flex flex-col gap-2">
          <DocumentThumbnail
            title={doc.title}
            mimeType={doc.mimeType}
            thumbnailUrl={doc.thumbnailUrl}
            onClick={() => onPreview({ id: doc.id, title: doc.title })}
          />
          <div className="flex flex-col gap-1">
            <p className="line-clamp-1 text-xs font-medium text-slate-700" title={doc.title}>
              {doc.title}
            </p>
            <button
              type="button"
              onClick={() => onSubjectClick(doc.subject)}
              title={`Voir tous les documents de ${doc.subject}`}
              className="hover:text-accent line-clamp-1 text-left text-xs text-slate-400 hover:underline"
            >
              {doc.subject}
            </button>
            <LikeButton
              liked={likedDocIds.has(doc.id)}
              label={doc.title}
              onClick={() => onToggleLike(doc.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Favorites() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [likedDocuments, setLikedDocuments] = useState<SearchResult[]>([]);
  const [likedDocIds, setLikedDocIds] = useState<Set<string>>(new Set());
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>([]);
  const [subjectDocs, setSubjectDocs] = useState<Record<string, SearchResult[]>>({});
  const [subjectTotals, setSubjectTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    getLikes(token)
      .then((res) => {
        setLikedDocuments(res.likedDocuments);
        setLikedDocIds(new Set(res.likedDocumentIds));
        setFavoriteSubjects(res.favoriteSubjects);

        // Aperçu des documents de chaque matière favorite, en parallèle.
        Promise.all(
          res.favoriteSubjects.map((subject) =>
            searchDocuments(token, { subject, limit: SUBJECT_PREVIEW_LIMIT }).then((r) => ({
              subject,
              results: r.results,
              total: r.total,
            })),
          ),
        ).then((all) => {
          setSubjectDocs(Object.fromEntries(all.map((r) => [r.subject, r.results])));
          setSubjectTotals(Object.fromEntries(all.map((r) => [r.subject, r.total])));
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggleLike = useCallback(
    (docId: string) => {
      if (!token) return;
      toggleDocumentLike(token, docId).then(({ liked }) => {
        setLikedDocIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(docId);
          else next.delete(docId);
          return next;
        });
        if (!liked) setLikedDocuments((prev) => prev.filter((d) => d.id !== docId));
      });
    },
    [token],
  );

  const handleUnfavoriteSubject = useCallback(
    (subject: string) => {
      if (!token) return;
      toggleSubjectFavorite(token, subject).then(({ favorited }) => {
        if (!favorited) setFavoriteSubjects((prev) => prev.filter((s) => s !== subject));
      });
    },
    [token],
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Mes favoris</h1>
        <p className="text-sm text-slate-500">Tes documents likés et tes matières favorites.</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Chargement…</p>}

      {favoriteSubjects.map((subject) => {
        const docs = subjectDocs[subject] ?? [];
        const total = subjectTotals[subject] ?? 0;
        return (
          <section key={subject}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
                  {subject}
                </h2>
                <button
                  type="button"
                  onClick={() => handleUnfavoriteSubject(subject)}
                  title={`Retirer ${subject} des favoris`}
                  className="rounded-full px-1.5 py-0.5 text-xs text-rose-400 hover:bg-rose-100 hover:text-rose-600"
                >
                  X
                </button>
              </div>
              {total > SUBJECT_PREVIEW_LIMIT && (
                <button
                  type="button"
                  onClick={() => navigate(`/search?subject=${encodeURIComponent(subject)}`)}
                  className="text-accent text-xs font-medium hover:underline"
                >
                  Voir les {total} documents →
                </button>
              )}
            </div>

            {docs.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">
                  Aucun document approuvé dans cette matière.
                </p>
              </div>
            ) : (
              <DocumentGrid
                documents={docs}
                likedDocIds={likedDocIds}
                onToggleLike={handleToggleLike}
                onPreview={setPreviewDoc}
                onSubjectClick={(s) => navigate(`/search?subject=${encodeURIComponent(s)}`)}
              />
            )}
          </section>
        );
      })}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Documents likés
        </h2>

        {!loading && likedDocuments.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              Aucun document liké pour le moment — like un document depuis le tableau de bord ou la
              recherche pour le retrouver ici.
            </p>
          </div>
        )}

        {likedDocuments.length > 0 && (
          <DocumentGrid
            documents={likedDocuments}
            likedDocIds={likedDocIds}
            onToggleLike={handleToggleLike}
            onPreview={setPreviewDoc}
            onSubjectClick={(s) => navigate(`/search?subject=${encodeURIComponent(s)}`)}
          />
        )}
      </section>

      {previewDoc && (
        <DocumentPreviewModal
          documentId={previewDoc.id}
          title={previewDoc.title}
          likedDocIds={likedDocIds}
          setLikedDocIds={setLikedDocIds}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
