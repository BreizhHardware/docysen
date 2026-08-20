export class WebAurionAuthError extends Error {
  constructor(message = "Identifiants WebAurion invalides") {
    super(message);
    this.name = "WebAurionAuthError";
  }
}

export class WebAurionUnavailableError extends Error {
  constructor(message = "WebAurion est indisponible, réessayez plus tard") {
    super(message);
    this.name = "WebAurionUnavailableError";
  }
}
