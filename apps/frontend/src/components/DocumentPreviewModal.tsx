import { useEffect, useState, useCallback } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useAuth } from "../context/AuthContext";
import { getPreviewUrl, toggleDocumentLike } from "../lib/api";
import LikeButton from "./LikeButton";

interface DocumentPreviewModalProps {
  documentId: string;
  title: string;
  likedDocIds: Set<string>;
  setLikedDocIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClose: () => void;
}

const MARKDOWN_MIME_TYPES = new Set(["text/markdown", "text/x-markdown"]);

/**
 * Consultation dans le navigateur (PDF, image, vidéo, DOCX/PPTX convertis en PDF, Markdown),
 * sans téléchargement préalable.
 */
export default function DocumentPreviewModal({
  documentId,
  title,
  likedDocIds,
  setLikedDocIds,
  onClose,
}: DocumentPreviewModalProps) {
  const { token } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [markdownHtml, setMarkdownHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getPreviewUrl(token, documentId)
      .then(async ({ url, previewMimeType: mimeType }) => {
        if (cancelled) return;
        setPreviewUrl(url);
        setPreviewMimeType(mimeType);

        if (MARKDOWN_MIME_TYPES.has(mimeType)) {
          const text = await fetch(url).then((res) => res.text());
          if (cancelled) return;
          setMarkdownHtml(DOMPurify.sanitize(await marked.parse(text)));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la prévisualisation.");
      });

    return () => {
      cancelled = true;
    };
  }, [token, documentId]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="truncate text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex gap-2">
            <button
                  key={documentId}
                  type="button"
                  onClick={() => handleToggleDocLike(documentId)}
                  title={
                    likedDocIds.has(documentId) ? `Retirer « ${title} » des favoris` : `Ajouter « ${title} » aux favoris`
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition
                    ${likedDocIds.has(documentId) ? "border-orange-300 bg-yellow-100 text-yellow-700 hover:bg-orange-100" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <span>{likedDocIds.has(documentId) ? "⭐" : "★ Ajouter"}</span>
                </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-surface hover:text-slate-600"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
          {error && <p className="p-6 text-sm text-red-600">{error}</p>}

          {!error && previewUrl && previewMimeType && (
            <PreviewBody url={previewUrl} mimeType={previewMimeType} markdownHtml={markdownHtml} />
          )}

          {!error && !previewUrl && (
            <p className="p-6 text-sm text-slate-500">Chargement de la prévisualisation…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  url,
  mimeType,
  markdownHtml,
}: {
  url: string;
  mimeType: string;
  markdownHtml: string | null;
}) {
  if (MARKDOWN_MIME_TYPES.has(mimeType)) {
    if (!markdownHtml) return <p className="p-6 text-sm text-slate-500">Chargement…</p>;
    return (
      <div
        className="prose prose-slate max-w-none p-6"
        // eslint-disable-next-line react/no-danger -- assaini par DOMPurify (voir useEffect)
        dangerouslySetInnerHTML={{ __html: markdownHtml }}
      />
    );
  }

  if (mimeType === "application/pdf") {
    return (
      // oxlint-disable-next-line react/iframe-missing-sandbox -- Pas de sandbox pour que les PDF puisse etre visibles dans le navigateur
      <iframe
        title="Aperçu du document"
        src={url}
        referrerPolicy="no-referrer"
        className="h-full w-full"
      />
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <video src={url} controls className="max-h-full max-w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm text-slate-500">
        Ce type de fichier ne peut pas être prévisualisé dans le navigateur.
      </p>
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent">
        Télécharger le fichier
      </a>
    </div>
  );
}
