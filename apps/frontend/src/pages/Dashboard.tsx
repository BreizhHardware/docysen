import { useAuth } from "../context/AuthContext";

const STAT_CARDS = [
  { label: "Documents totaux", value: "N/A" },
  { label: "En attente de modération", value: "N/A" },
  { label: "Approuvés ce mois-ci", value: "N/A" },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Bonjour {user?.firstName} 👋</h1>
        <p className="text-sm text-slate-500">Voici un aperçu de l'activité sur Docysen.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          Aucun document pour le moment. Les phases suivantes du plan ajouteront l'upload, l'OCR, le
          tagging et la modération.
        </p>
      </div>
    </div>
  );
}
