/**
 * Thin wrapper around the EmailJS REST API.
 *
 * EmailJS is normally a browser SDK, but they expose a REST endpoint at
 *   POST https://api.emailjs.com/api/v1.0/email/send
 * which accepts the same payload the SDK builds. When the account has "Allow
 * EmailJS API for non-browser applications" disabled (the default), the
 * private key must be included as `accessToken` — otherwise the request 403s.
 *
 * This module is intentionally side-effect free at import time: if env vars
 * are missing it just logs a warning and `sendTemplate` becomes a noop. That
 * way the booking flow still works for someone running the project locally
 * without EmailJS configured.
 */

type EmailJSConfig = {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
};

function readConfig(): EmailJSConfig | null {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey, privateKey };
}

let warnedOnce = false;

/**
 * Send one EmailJS template with the given variables. Returns silently on
 * success, throws on transport / API errors so callers can decide whether
 * to surface or swallow.
 */
export async function sendTemplate(
  templateParams: Record<string, string | number>,
): Promise<void> {
  const cfg = readConfig();
  if (!cfg) {
    if (!warnedOnce) {
      // eslint-disable-next-line no-console
      console.warn(
        "[email] EMAILJS_* env vars not set — notifications are disabled. " +
          "Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY (and PRIVATE_KEY if strict mode is on).",
      );
      warnedOnce = true;
    }
    return;
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: cfg.serviceId,
      template_id: cfg.templateId,
      user_id: cfg.publicKey,
      // accessToken = private key; required when "non-browser strict mode" is on.
      ...(cfg.privateKey ? { accessToken: cfg.privateKey } : {}),
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`EmailJS ${res.status}: ${body}`);
  }
}
