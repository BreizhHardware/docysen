import { useEffect, useState, useCallback } from "react";
import type { SearchResult } from "@docysen/types";
import { useAuth } from "../context/AuthContext";
import {
  getDashboardStats,
  getLikes,
  searchDocuments,
  toggleDocumentLike,
  toggleSubjectFavorite,
} from "../lib/api";
import DocumentThumbnail from "../components/DocumentThumbnail";
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import LikeButton from "../components/LikeButton";

interface Stats {
  total: number;
  pending: number;
  approvedThisMonth: number;
}

export default function Dashboard() {
  const { user, token } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDocs, setRecentDocs] = useState<SearchResult[]>([]);
  const [likedDocIds, setLikedDocIds] = useState<Set<string>>(new Set());
  const [favoriteSubjects, setFavoriteSubjects] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<{ id: string; title: string } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Chargement initial
  useEffect(() => {
    if (!token) return;

    getDashboardStats(token)
      .then(setStats)
      .finally(() => setLoadingStats(false));

    searchDocuments(token, { limit: 6 })
      .then((res) => setRecentDocs(res.results))
      .finally(() => setLoadingDocs(false));

    getLikes(token).then(({ likedDocumentIds, favoriteSubjects: subjects }) => {
      setLikedDocIds(new Set(likedDocumentIds));
      setFavoriteSubjects(new Set(subjects));
    });
  }, [token]);

  const handleToggleDocLike = useCallback(
    (docId: string) => {
      if (!token) return;
      toggleDocumentLike(token, docId).then(({ liked }) => {
        setLikedDocIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(docId);
          else next.delete(docId);
          return next;
        });
      });
    },
    [token],
  );

  const handleToggleSubjectFav = useCallback(
    (subject: string) => {
      if (!token) return;
      toggleSubjectFavorite(token, subject).then(({ favorited }) => {
        setFavoriteSubjects((prev) => {
          const next = new Set(prev);
          if (favorited) next.add(subject);
          else next.delete(subject);
          return next;
        });
      });
    },
    [token],
  );

  // Matières extraites des docs récents (dédoublonnées)
  const recentSubjects = Array.from(new Set(recentDocs.map((d) => d.subject))).slice(0, 8);

  const STAT_CARDS = [
    {
      label: "Documents disponibles",
      value: loadingStats ? "…" : (stats?.total ?? "N/A"),
      color: "text-slate-800",
    },
    {
      label: "En attente de modération",
      value: loadingStats ? "…" : (stats?.pending ?? "N/A"),
      color: "text-amber-600",
    },
    {
      label: "Approuvés ce mois-ci",
      value: loadingStats ? "…" : (stats?.approvedThisMonth ?? "N/A"),
      color: "text-emerald-600",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Bonjour {user?.firstName} 👋</h1>
        <p className="text-sm text-slate-500">Voici un aperçu de l'activité sur Docysen.</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Matières populaires avec favoris */}
      {recentSubjects.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Matières récentes
          </h2>
          <div className="flex flex-wrap gap-2">
            {recentSubjects.map((subject) => {
              const isFav = favoriteSubjects.has(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => handleToggleSubjectFav(subject)}
                  title={
                    isFav ? `Retirer ${subject} des favoris` : `Ajouter ${subject} aux favoris`
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition
                    ${isFav ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <span>{isFav ? "♥" : "♡"}</span>
                  {subject}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Derniers documents en ligne */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Derniers documents en ligne
        </h2>

        {loadingDocs && (
          <p className="text-sm text-slate-400">Chargement des documents…</p>
        )}

        {!loadingDocs && recentDocs.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              Aucun document approuvé pour le moment.
            </p>
          </div>
        )}

        {recentDocs.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {recentDocs.map((doc) => (
              <div key={doc.id} className="flex flex-col gap-2">
                <DocumentThumbnail
                  title={doc.title}
                  mimeType={doc.mimeType}
                  thumbnailUrl={doc.thumbnailUrl}
                  onClick={() => setPreviewDoc({ id: doc.id, title: doc.title })}
                />
                <div className="flex flex-col gap-1">
                  <p className="line-clamp-1 text-xs font-medium text-slate-700" title={doc.title}>
                    {doc.title}
                  </p>
                  <p className="line-clamp-1 text-xs text-slate-400">{doc.subject}</p>
                  <LikeButton
                    liked={likedDocIds.has(doc.id)}
                    label={doc.title}
                    onClick={() => handleToggleDocLike(doc.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Matières favorites (si au moins une) */}
      {favoriteSubjects.size > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tes matières favorites
          </h2>
          <div className="flex flex-wrap gap-2">
            {Array.from(favoriteSubjects).map((subject) => (
              <span
                key={subject}
                className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700"
              >
                <span>♥</span>
                {subject}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Modal de prévisualisation */}
      {previewDoc && (
        <DocumentPreviewModal
          documentId={previewDoc.id}
          title={previewDoc.title}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
