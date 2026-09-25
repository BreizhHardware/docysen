import { describe, expect, it } from "vitest";

import { buildIsenEmail, parseAurionName } from "../src/aurion.js";

describe("parseAurionName", () => {
  it("sépare NOM (majuscules) et Prénom", () => {
    expect(parseAurionName("DUPONT Jean")).toEqual({ lastName: "DUPONT", firstName: "Jean" });
  });

  it("gère les noms composés en majuscules", () => {
    expect(parseAurionName("DE LA FONTAINE Jean-Marie")).toEqual({
      lastName: "DE LA FONTAINE",
      firstName: "Jean-Marie",
    });
  });

  it("gère un prénom composé", () => {
    expect(parseAurionName("MARTIN Anne-Sophie")).toEqual({
      lastName: "MARTIN",
      firstName: "Anne-Sophie",
    });
  });

  it("repli sur le dernier token quand tout est dans la même casse", () => {
    expect(parseAurionName("Dupont Jean")).toEqual({ lastName: "Dupont", firstName: "Jean" });
  });

  it("rejette un nom trop court ou invalide", () => {
    expect(() => parseAurionName("")).toThrow();
    expect(() => parseAurionName("A")).toThrow();
  });
});

describe("buildIsenEmail", () => {
  it("construit l'email au format prenom.nom@isen-ouest.yncrea.fr", () => {
    expect(buildIsenEmail("DUPONT Jean")).toBe("jean.dupont@isen-ouest.yncrea.fr");
  });

  it("retire les accents et normalise les tirets/apostrophes", () => {
    expect(buildIsenEmail("O'BRIEN Éléonore")).toBe("eleonore.o-brien@isen-ouest.yncrea.fr");
  });

  it("gère les noms composés en minuscules dans l'email", () => {
    expect(buildIsenEmail("DE LA FONTAINE Jean-Marie")).toBe(
      "jean-marie.de-la-fontaine@isen-ouest.yncrea.fr",
    );
  });

  it("accepte un domaine personnalisé", () => {
    expect(buildIsenEmail("DUPONT Jean", "example.test")).toBe("jean.dupont@example.test");
  });
});
