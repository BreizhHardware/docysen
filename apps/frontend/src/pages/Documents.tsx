import { useEffect, useState } from "react";
import type { DocumentSummary } from "@docysen/types";
import { useAuth } from "../context/AuthContext";
import { getDocuments } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function Documents() {
  const { token, user } = useAuth();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Étudiant : ses documents. Admin/modérateur : tous, voir GET /documents côté api-service.
  const isModerator = user?.role === "admin" || user?.role === "moderator";

  useEffect(() => {
    if (!token) return;
    getDocuments(token)
      .then(setDocuments)
      .catch(() => setError("Impossible de charger les documents. Réessaie plus tard."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Documents</h1>
        <p className="text-sm text-slate-500">
          {isModerator ? "Tous les documents déposés." : "Les documents que tu as déposés."}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && documents.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Aucun document pour le moment.</p>
        </div>
      )}

      {documents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Matière</th>
                <th className="px-4 py-3">Promo</th>
                <th className="px-4 py-3">Semestre</th>
                {isModerator && <th className="px-4 py-3">Déposé par</th>}
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Déposé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{doc.title}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.subject}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.promoLabel}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.semester}</td>
                  {isModerator && <td className="px-4 py-3 text-slate-600">{doc.uploaderName}</td>}
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
