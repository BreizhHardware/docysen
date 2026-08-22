import FileTypeIcon from "./FileTypeIcon";

interface DocumentThumbnailProps {
  title: string;
  mimeType: string;
  thumbnailUrl: string | null;
  onClick: () => void;
  className?: string;
}

/**
 * Tuile miniature réutilisée par pages/Search.tsx (grille) et pages/Moderation.tsx (file
 * d'attente). Fallback icône par type tant que `thumbnailUrl` est absent
 * (génération pas encore terminée, ou format non pris en charge).
 */
export default function DocumentThumbnail({
  title,
  mimeType,
  thumbnailUrl,
  onClick,
  className = "",
}: DocumentThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Consulter « ${title} »`}
      className={`block aspect-[4/3] w-full overflow-hidden rounded-md border border-slate-200 transition hover:ring-2 hover:ring-accent ${className}`}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <FileTypeIcon mimeType={mimeType} />
      )}
    </button>
  );
}
