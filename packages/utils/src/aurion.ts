import { z } from "zod";

const RawNameSchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[\p{L}\s\-']+$/u, "Format de nom WebAurion invalide");

export interface ParsedAurionName {
  firstName: string;
  lastName: string;
}

function isShouty(token: string): boolean {
  return token === token.toUpperCase() && token !== token.toLowerCase();
}

/**
 * Normalise un token de nom pour l'utiliser dans un email :
 * minuscules, accents retirés, apostrophes/espaces internes remplacés par un tiret.
 */
function slugifyNamePart(part: string): string {
  return part
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s']+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * WebAurion (scrapé depuis `li.ui-widget-header > h3` après login, voir
 * apps/auth-service/src/webaurion/client.ts) affiche le nom complet au format "NOM Prénom".
 * On distingue donc les tokens en MAJUSCULES (nom de famille, convention WebAurion) des
 * autres (prénom), avec un repli sur "premier token = nom, dernier = prénom" si tous les
 * tokens ont la même casse.
 */
export function parseAurionName(fullName: string): ParsedAurionName {
  const parsed = RawNameSchema.parse(fullName);
  const tokens = parsed.split(/\s+/);

  const upper = tokens.filter(isShouty);
  const rest = tokens.filter((t) => !isShouty(t));

  if (upper.length > 0 && rest.length > 0) {
    return {
      lastName: upper.join(" "),
      firstName: rest.join(" "),
    };
  }

  return {
    lastName: tokens.slice(0, -1).join(" ") || tokens[0],
    firstName: tokens[tokens.length - 1],
  };
}

/**
 * Construit l'adresse email ISEN depuis le nom complet WebAurion.
 * Exemple : "DUPONT Jean-Marie" → "jean-marie.dupont@isen-ouest.yncrea.fr"
 */
export function buildIsenEmail(fullName: string, domain = "isen-ouest.yncrea.fr"): string {
  const { firstName, lastName } = parseAurionName(fullName);
  const local = `${slugifyNamePart(firstName)}.${slugifyNamePart(lastName)}`;
  return `${local}@${domain}`;
}
