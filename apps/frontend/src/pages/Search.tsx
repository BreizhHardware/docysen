import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import type { FileTypeCategory, PromoSummary, SearchResult } from "@docysen/types";
import { useAuth } from "../context/AuthContext";
import { getPromos, getSubjects, searchDocuments, getLikes, toggleDocumentLike } from "../lib/api";
import DocumentThumbnail from "../components/DocumentThumbnail";
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import LikeButton from "../components/LikeButton";

const FILE_TYPE_OPTIONS: { value: FileTypeCategory | ""; label: string }[] = [
  { value: "", label: "Tous types" },
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "pptx", label: "PPTX" },
  { value: "image", label: "Image" },
  { value: "video", label: "Vidéo" },
  { value: "markdown", label: "Markdown" },
  { value: "other", label: "Autre" },
];

const PAGE_SIZE = 24;
// Laisse l'utilisateur finir de taper avant de relancer la recherche à chaque frappe.
const SEARCH_DEBOUNCE_MS = 300;

export default function Search() {
  const { token } = useAuth();
  // q/subject vivent dans l'URL : un lien externe (barre de recherche
  // du haut, matière favorite) doit mettre à jour ces filtres même si Search est déjà montée.
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const subject = searchParams.get("subject") ?? "";

  const [promos, setPromos] = useState<PromoSummary[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [promoId, setPromoId] = useState("");
  const [fileType, setFileType] = useState<FileTypeCategory | "">("");
  const [page, setPage] = useState(0);
  const [likedDocIds, setLikedDocIds] = useState<Set<string>>(new Set());

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    getPromos(token)
      .then(setPromos)
      .catch(() => {
        /* les filtres promo restent vides, pas bloquant pour la recherche */
      });
    getSubjects(token)
      .then(setSubjects)
      .catch(() => {
        /* le filtre matière reste vide, pas bloquant pour la recherche */
      });
    getLikes(token).then(({ likedDocumentIds, favoriteSubjects: subjects }) => {
      setLikedDocIds(new Set(likedDocumentIds));
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

  useEffect(() => {
    if (!token) return;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchDocuments(token, {
        q: q || undefined,
        promo: promoId || undefined,
        subject: subject || undefined,
        fileType: fileType || undefined,
        page,
        limit: PAGE_SIZE,
      })
        .then((res) => {
          setResults(res.results);
          setTotal(res.total);
        })
        .catch(() => setError("Impossible de charger les résultats. Réessaie plus tard."))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [token, q, promoId, subject, fileType, page]);

  // Toute modif de filtre repart de la première page : une page 3 filtrée différemment n'a plus de sens.
  function updateFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  function updateUrlFilter(param: "q" | "subject") {
    return (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(param, value);
          else next.delete(param);
          return next;
        },
        { replace: true },
      );
      setPage(0);
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Recherche</h1>
        <p className="text-sm text-slate-500">
          Documents approuvés, avec aperçu — pas besoin de les télécharger pour les consulter.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Rechercher (titre, matière, contenu...)"
          value={q}
          onChange={(e) => updateUrlFilter("q")(e.target.value)}
          className="input lg:col-span-2"
        />
        <select
          value={promoId}
          onChange={(e) => updateFilter(setPromoId)(e.target.value)}
          className="input"
        >
          <option value="">Toutes promos</option>
          {promos.map((promo) => (
            <option key={promo.id} value={promo.id}>
              {promo.label}
            </option>
          ))}
        </select>
        <select
          value={fileType}
          onChange={(e) => {
            setFileType(e.target.value as FileTypeCategory | "");
            setPage(0);
          }}
          className="input"
        >
          {FILE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => updateUrlFilter("subject")(e.target.value)}
          className="input lg:col-span-4"
        >
          <option value="">Toutes matières</option>
          {/* Filet de sécurité : une matière arrivée par lien (ex. depuis Favoris) peut ne plus
              avoir de document approuvé et donc être absente de la liste chargée depuis /subjects. */}
          {subject && !subjects.includes(subject) && <option value={subject}>{subject}</option>}
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && results.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Aucun résultat pour ces critères.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {results.map((doc) => (
          <div key={doc.id} className="flex flex-col gap-2">
            <DocumentThumbnail
              title={doc.title}
              mimeType={doc.mimeType}
              thumbnailUrl={doc.thumbnailUrl}
              onClick={() => setPreviewing({ id: doc.id, title: doc.title })}
            />
            <div>
              <p className="truncate text-sm font-medium text-slate-800">{doc.title}</p>
              <p className="truncate text-xs text-slate-500">
                {doc.subject} · {doc.promoLabel} {doc.semester}
              </p>
              <LikeButton
                liked={likedDocIds.has(doc.id)}
                label={doc.title}
                onClick={() => handleToggleDocLike(doc.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 text-sm text-slate-600">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Précédent
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      {previewing && (
        <DocumentPreviewModal
          documentId={previewing.id}
          title={previewing.title}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
