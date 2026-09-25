import type { FileTypeCategory } from "@docysen/types";

import { fileTypeFromMimeType } from "../lib/fileType";

const PATHS: Record<FileTypeCategory, string> = {
  pdf: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5",
  docx: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5",
  pptx: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5",
  markdown: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5",
  image: "M4 5h16v14H4V5zm4 8l3-3 3 3 4-5 2 2M8 9a1 1 0 100-2 1 1 0 000 2z",
  video: "M4 6h11v12H4V6zm11 3l5-2v10l-5-2V9z",
  other: "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z",
};

const LABELS: Record<FileTypeCategory, string> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  markdown: "MD",
  image: "Image",
  video: "Vidéo",
  other: "Fichier",
};

/**
 * Fallback icône par type de fichier, affiché tant que `thumbnailUrl` est absent (voir
 * DocumentThumbnail).
 */
export default function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const fileType = fileTypeFromMimeType(mimeType);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-10 w-10"
      >
        <path d={PATHS[fileType]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-medium tracking-wide uppercase">{LABELS[fileType]}</span>
    </div>
  );
}
