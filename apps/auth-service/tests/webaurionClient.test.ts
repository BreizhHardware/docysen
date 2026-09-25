import { describe, it, expect, vi, beforeEach } from "vitest";

const get = vi.fn();
const post = vi.fn();
const create = vi.fn(() => ({ get, post }));

vi.mock("axios", () => ({
  default: { create: (...args: unknown[]) => create(...args) },
}));
vi.mock("axios-cookiejar-support", () => ({
  wrapper: (client: unknown) => client,
}));

const { loginToWebAurion } = await import("../src/webaurion/client.js");
const { WebAurionAuthError, WebAurionUnavailableError } =
  await import("../src/webaurion/errors.js");

const BASE_URL = "https://web.isen-ouest.fr/webAurion";
const nameHtml = `<html><body><li class="ui-widget-header"><h3>DUPONT Jean</h3></li></body></html>`;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("loginToWebAurion", () => {
  it("lève WebAurionUnavailableError si le GET de la page de login échoue", async () => {
    get.mockRejectedValueOnce(new Error("network down"));
    await expect(loginToWebAurion("jdupont", "secret", BASE_URL)).rejects.toThrow(
      WebAurionUnavailableError,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("lève WebAurionUnavailableError si le POST des identifiants échoue", async () => {
    get.mockResolvedValueOnce({ data: "<html></html>" });
    post.mockRejectedValueOnce(new Error("timeout"));
    await expect(loginToWebAurion("jdupont", "secret", BASE_URL)).rejects.toThrow(
      WebAurionUnavailableError,
    );
  });

  it("lève WebAurionAuthError si la page contient un marqueur d'échec", async () => {
    get.mockResolvedValueOnce({ data: "<html></html>" });
    post.mockResolvedValueOnce({ data: "<html>Login ou mot de passe invalide</html>" });
    await expect(loginToWebAurion("jdupont", "wrong", BASE_URL)).rejects.toThrow(
      WebAurionAuthError,
    );
  });

  it("extrait le nom depuis la page de login si présent", async () => {
    get.mockResolvedValueOnce({ data: "<html></html>" });
    post.mockResolvedValueOnce({ data: nameHtml });
    const result = await loginToWebAurion("jdupont", "secret", BASE_URL);
    expect(result).toEqual({ rawName: "DUPONT Jean" });
    expect(get).toHaveBeenCalledTimes(1);

    // Ne rejette jamais sur un statut HTTP non-2xx : la détection d'échec se fait sur le
    // contenu de la page, pas sur le code retour (voir FAILURE_MARKERS).
    const config = create.mock.calls[0][0] as { validateStatus: (status: number) => boolean };
    expect(config.validateStatus(500)).toBe(true);
  });

  it("retombe sur la page Planning si le nom n'est pas sur la page de login", async () => {
    get
      .mockResolvedValueOnce({ data: "<html></html>" }) // page de login (établissement de session)
      .mockResolvedValueOnce({ data: nameHtml }); // page Planning
    post.mockResolvedValueOnce({ data: "<html><body>pas de nom ici</body></html>" });
    const result = await loginToWebAurion("jdupont", "secret", BASE_URL);
    expect(result).toEqual({ rawName: "DUPONT Jean" });
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(2, `${BASE_URL}/faces/Planning.xhtml`);
  });

  it("lève WebAurionUnavailableError si le nom reste introuvable même sur Planning", async () => {
    get
      .mockResolvedValueOnce({ data: "<html></html>" })
      .mockResolvedValueOnce({ data: "<html><body>toujours rien</body></html>" });
    post.mockResolvedValueOnce({ data: "<html><body>pas de nom ici</body></html>" });
    await expect(loginToWebAurion("jdupont", "secret", BASE_URL)).rejects.toThrow(
      WebAurionUnavailableError,
    );
  });

  it("lève WebAurionUnavailableError si la requête Planning elle-même échoue", async () => {
    get
      .mockResolvedValueOnce({ data: "<html></html>" })
      .mockRejectedValueOnce(new Error("planning down"));
    post.mockResolvedValueOnce({ data: "<html><body>pas de nom ici</body></html>" });
    await expect(loginToWebAurion("jdupont", "secret", BASE_URL)).rejects.toThrow(
      WebAurionUnavailableError,
    );
  });
});
