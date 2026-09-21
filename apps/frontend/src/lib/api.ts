import type {
  ChangeRoleBody,
  CreateDocumentBody,
  CreateDocumentResponse,
  DocumentSummary,
  LikesResponse,
  LoginResponse,
  ModerationEvent,
  PreviewUrlResponse,
  PromoSummary,
  SearchQuery,
  SearchResponse,
  SearchResult,
  UpdatePromoBody,
  UserRole,
  UserSummary,
} from "@docysen/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
// api-service est un service séparé de auth-service, pas juste une autre route.
const API_SERVICE_BASE_URL = import.meta.env.VITE_API_SERVICE_BASE_URL ?? "http://localhost:3002";

export const SESSION_STORAGE_KEY = "docysen.session";
export const SESSION_EXPIRED_KEY = "docysen.sessionExpired";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(
  res: Response,
  { redirectOn401 = true }: { redirectOn401?: boolean } = {},
): Promise<T> {
  if (redirectOn401 && res.status === 401) {
    // Session expirée ou invalide : purge et renvoie au login.
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    if (!window.location.pathname.startsWith("/login")) {
      // window.location.href déclenche un rechargement complet, qui vide le JS en mémoire :
      // on passe donc par sessionStorage plutôt que par un state React pour survivre au reload.
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
      window.location.href = "/login";
    }
    throw new ApiError("Session expirée", 401);
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status);
  }
  return body as T;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then((res) => handle<LoginResponse>(res, { redirectOn401: false }));
}

export function getPromos(token: string): Promise<PromoSummary[]> {
  return fetch(`${API_SERVICE_BASE_URL}/promos`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<PromoSummary[]>(res));
}

/** Matières distinctes des documents approuvés, pour peupler le dropdown de recherche. */
export function getSubjects(token: string): Promise<string[]> {
  return fetch(`${API_SERVICE_BASE_URL}/subjects`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<string[]>(res));
}

/** Crée le document en base (status "pending") et retourne une URL présignée pour l'upload direct. */
export function createDocument(
  token: string,
  body: CreateDocumentBody,
): Promise<CreateDocumentResponse> {
  return fetch(`${API_SERVICE_BASE_URL}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then((res) => handle<CreateDocumentResponse>(res));
}

/** Upload direct du fichier vers Garage/S3 via l'URL présignée, ne passe jamais par nos services. */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new ApiError("Échec de l'upload du fichier, réessaie.", res.status);
  }
}

/** Déclenche la génération de miniature une fois le fichier bien arrivé sur Garage/S3 */
export function confirmUpload(token: string, documentId: string): Promise<{ status: string }> {
  return fetch(`${API_SERVICE_BASE_URL}/documents/${documentId}/confirm-upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle(res));
}

/** URL présignée courte durée pour consulter le document dans le navigateur (voir DocumentPreview). */
export function getPreviewUrl(token: string, documentId: string): Promise<PreviewUrlResponse> {
  return fetch(`${API_SERVICE_BASE_URL}/documents/${documentId}/preview-url`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<PreviewUrlResponse>(res));
}

/**
 * File d'attente de modération (admin/modérateur uniquement, "pending" hors documents du modérateur
 * lui-même).
 */
export function getModerationQueue(token: string): Promise<SearchResult[]> {
  return fetch(`${API_SERVICE_BASE_URL}/moderation/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<SearchResult[]>(res));
}

export function approveDocument(token: string, documentId: string): Promise<DocumentSummary> {
  return fetch(`${API_SERVICE_BASE_URL}/moderation/${documentId}/approve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<DocumentSummary>(res));
}

export function rejectDocument(
  token: string,
  documentId: string,
  reason: string,
): Promise<DocumentSummary> {
  return fetch(`${API_SERVICE_BASE_URL}/moderation/${documentId}/reject`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason }),
  }).then((res) => handle<DocumentSummary>(res));
}

export function getModerationHistory(
  token: string,
  documentId: string,
): Promise<ModerationEvent[]> {
  return fetch(`${API_SERVICE_BASE_URL}/moderation/${documentId}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<ModerationEvent[]>(res));
}

/**
 * Grille de résultats, consultable par tout étudiant : documents `approved` uniquement, avec
 * miniatures présignées côté serveur.
 */
export function searchDocuments(
  token: string,
  query: Partial<SearchQuery>,
): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.promo) params.set("promo", query.promo);
  if (query.subject) params.set("subject", query.subject);
  if (query.fileType) params.set("fileType", query.fileType);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  return fetch(`${API_SERVICE_BASE_URL}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<SearchResponse>(res));
}

export function getDashboardStats(
  token: string,
): Promise<{ total: number; pending: number; approvedThisMonth: number }> {
  return fetch(`${API_SERVICE_BASE_URL}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle(res));
}

export function getLikes(token: string): Promise<LikesResponse> {
  return fetch(`${API_SERVICE_BASE_URL}/likes`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle(res));
}

export function toggleDocumentLike(
  token: string,
  documentId: string,
): Promise<{ liked: boolean; count: number }> {
  return fetch(`${API_SERVICE_BASE_URL}/likes/documents/${documentId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle(res));
}

export function toggleSubjectFavorite(
  token: string,
  subject: string,
): Promise<{ favorited: boolean; subject: string }> {
  return fetch(`${API_SERVICE_BASE_URL}/likes/subjects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject }),
  }).then((res) => handle(res));
}

// ── Admin ──────────────────────────────────────────────────────────────────

export function getAdminUsers(token: string): Promise<UserSummary[]> {
  return fetch(`${API_SERVICE_BASE_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle<UserSummary[]>(res));
}

export function changeUserRole(
  token: string,
  userId: string,
  role: UserRole,
): Promise<{
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}> {
  return fetch(`${API_SERVICE_BASE_URL}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role } satisfies ChangeRoleBody),
  }).then((res) => handle(res));
}

export function getAdminOverview(
  token: string,
): Promise<{ byStatus: Record<string, number>; totalStorageBytes: number }> {
  return fetch(`${API_SERVICE_BASE_URL}/admin/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((res) => handle(res));
}

export function updatePromo(
  token: string,
  promoId: string,
  body: UpdatePromoBody,
): Promise<PromoSummary> {
  return fetch(`${API_SERVICE_BASE_URL}/promos/${promoId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then((res) => handle<PromoSummary>(res));
}

export function deletePromo(token: string, promoId: string): Promise<void> {
  return fetch(`${API_SERVICE_BASE_URL}/promos/${promoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status);
    }
  });
}

export function setNotificationEmail(
  token: string,
  choice: { optIn: true; email: string } | { optIn: false },
): Promise<{ notificationEmail: string | null }> {
  return fetch(`${API_BASE_URL}/users/me/notification-email`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(choice),
  }).then((res) => handle(res));
}
