import "dotenv/config";

// Loud guard so a developer doesn't accidentally point the test suite at
// production. Module + integration tests TRUNCATE rows, so refuse to run
// against anything that smells like Neon / a managed Postgres host.
const url = process.env.DATABASE_URL ?? "";
const looksRemote =
  /neon\.tech|amazonaws\.com|supabase|render\.com|railway|fly\.io/i.test(url);

if (looksRemote) {
  throw new Error(
    `Refusing to run tests against a remote-looking DATABASE_URL (${url}). ` +
      `Point apps/api/.env at a local Postgres (e.g. Docker localhost:5432) first.`,
  );
}

// Disable real email sending during tests — clear EmailJS env vars so the
// notifications service hits its built-in noop path (just logs a warning).
// This stops the test suite from blasting EmailJS quota on every run.
delete process.env.EMAILJS_SERVICE_ID;
delete process.env.EMAILJS_TEMPLATE_ID;
delete process.env.EMAILJS_PUBLIC_KEY;
delete process.env.EMAILJS_PRIVATE_KEY;
