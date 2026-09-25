import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";
import { CookieJar } from "tough-cookie";

import { WebAurionAuthError, WebAurionUnavailableError } from "./errors.js";

/**
 * Il existe une page de login "legacy" (Spring, hors SSO Keycloak) à
 * `${baseUrl}/faces/Login.xhtml`, qui POST sur `${baseUrl}/login` : c'est l'approche suivie par
 * https://github.com/appen-isen/studysen. Le piège : il faut d'abord faire un GET sur cette page
 * pour établir la session (cookie JSESSIONID) _avant_ de poster les identifiants sur `/login`,
 * sinon on retombe sur le SSO Keycloak. axios ne gère pas les cookies entre requêtes par défaut
 * (contrairement à `fetch({credentials:"include"})` côté navigateur/RN), d'où le cookie jar
 * explicite.
 */
const LOGIN_PAGE_PATH = "/faces/Login.xhtml";
const LOGIN_POST_PATH = "/login";
const FAILURE_MARKERS = ["Login or password invalid", "Login ou mot de passe invalide"];

const NAME_SELECTORS = [
  "li.ui-widget-header > h3",
  "li.ui-widget-header h3",
  ".ui-widget-header h3",
  "#headerForm h3",
];

export interface WebAurionLoginResult {
  /**
   * Nom complet brut tel qu'affiché par WebAurion, format exact non garanti, à parser via
   *
   * @docysen/utils.
   */
  rawName: string;
}

/**
 * Authentifie un utilisateur auprès de WebAurion (formulaire legacy, pas la SSO Keycloak) et
 * récupère son nom affiché.
 *
 * Les identifiants ne transitent qu'en mémoire le temps de cet appel : ils ne sont ni écrits sur
 * disque, ni loggés, ni retournés par cette fonction. Le cookie jar est local à cet appel (nouvelle
 * instance à chaque login), jamais partagé/persisté.
 */
export async function loginToWebAurion(
  username: string,
  password: string,
  baseUrl: string,
): Promise<WebAurionLoginResult> {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: 15_000,
      validateStatus: () => true,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
      },
    }),
  );

  try {
    // Établit la session (cookie JSESSIONID) sur le formulaire legacy avant de poster les identifiants.
    await client.get<string>(`${baseUrl}${LOGIN_PAGE_PATH}`);
  } catch {
    throw new WebAurionUnavailableError();
  }

  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);

  let html: string;
  try {
    const response = await client.post<string>(`${baseUrl}${LOGIN_POST_PATH}`, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    html = response.data;
  } catch {
    throw new WebAurionUnavailableError();
  }

  if (FAILURE_MARKERS.some((marker) => html.includes(marker))) {
    throw new WebAurionAuthError();
  }

  const $ = cheerio.load(html);
  let rawName = "";
  for (const selector of NAME_SELECTORS) {
    rawName = $(selector).first().text().trim();
    if (rawName) break;
  }

  if (!rawName) {
    // Authentifié (pas de marqueur d'échec) mais le nom n'est pas sur cette page
    // WebAurion l'affiche peut-être seulement sur la page planning, comme dans studysen.
    try {
      const planningResponse = await client.get<string>(`${baseUrl}/faces/Planning.xhtml`);
      const $planning = cheerio.load(planningResponse.data);
      for (const selector of NAME_SELECTORS) {
        rawName = $planning(selector).first().text().trim();
        if (rawName) break;
      }
    } catch {
      // on retombe sur l'erreur générique ci-dessous
    }
  }

  if (!rawName) {
    throw new WebAurionUnavailableError(
      `Impossible de récupérer le nom de l'utilisateur depuis WebAurion, si le problème persiste contactez l'administrateur du service.`,
    );
  }

  return { rawName };
}
