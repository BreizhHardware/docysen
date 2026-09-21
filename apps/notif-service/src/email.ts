import type { RejectionEmailPayload } from "@docysen/types";
import nodemailer from "nodemailer";

import { env } from "./env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // Pas d'auth si SMTP_USER est vide
  ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
});

/**
 * Envoie un email de rejet à l'étudiant. Appelé uniquement si l'étudiant a fourni un
 * notificationEmail (opté in).
 */
export async function sendRejectionEmail(payload: RejectionEmailPayload): Promise<void> {
  const { recipientEmail, recipientName, documentTitle, reason } = payload;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: recipientEmail,
    subject: `Votre document "${documentTitle}" a été rejeté`,
    text: [
      `Bonjour ${recipientName},`,
      "",
      `Votre document "${documentTitle}" a été rejeté par l'équipe de modération.`,
      "",
      "Motif du rejet :",
      reason,
      "",
      "Vous pouvez soumettre un nouveau document corrigé depuis votre espace.",
      "",
      "Cordialement,",
      "L'équipe Docysen",
    ].join("\n"),
    html: `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Votre document <strong>« ${documentTitle} »</strong> a été rejeté par l'équipe de modération.</p>
      <h3 style="margin-top:1.5em">Motif du rejet :</h3>
      <blockquote style="border-left:4px solid #e53e3e;padding-left:1em;color:#555">
        ${reason}
      </blockquote>
      <p>Vous pouvez soumettre un nouveau document corrigé depuis votre espace.</p>
      <p style="margin-top:2em">Cordialement,<br>L'équipe Docysen</p>
    `,
  });
}
