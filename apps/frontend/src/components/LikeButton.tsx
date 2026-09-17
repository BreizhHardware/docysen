export default function LikeButton({
  liked,
  label,
  onClick,
}: {
  liked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={liked ? `Retirer « ${label} » des favoris` : `Enregistrer « ${label} » dans les favoris`}
      className={`flex self-start items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition
        ${liked ? "bg-yellow-100 text-yellow-600 hover:bg-orange-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
    >
      <span>{liked ? "⭐" : "★ Ajouter"}</span>
    </button>
  );
}
