import type { DocumentStatus } from "@docysen/types";

const STYLES: Record<DocumentStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-accent-light text-accent",
  rejected: "bg-red-100 text-red-700",
};

const LABELS: Record<DocumentStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
};

export default function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
