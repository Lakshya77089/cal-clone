import "dotenv/config";

// Silence one specific deprecation warning that Vitest 2 triggers about Vite's
// CJS Node API. It's purely cosmetic noise on the test output (the suite still
// runs correctly), and is fixed in Vitest 3/4 — but bumping major versions
// just for this is overkill, so we filter it here.
const originalEmit = process.emit.bind(process);
process.emit = function (event: string, ...args: unknown[]) {
  if (event === "warning" && args[0] instanceof Error) {
    const msg = args[0].message;
    if (msg.includes("CJS build of Vite") || msg.includes("Vite CJS Node API")) {
      return false;
    }
  }
  return (originalEmit as (event: string, ...args: unknown[]) => boolean)(
    event,
    ...args,
  );
} as typeof process.emit;

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

// Disable real email sending during tests — explicitly set EmailJS env vars
// to empty strings BEFORE any module imports `dotenv/config`. Setting them
// (not deleting) is important: `dotenv` defaults to override:false, so once
// they're set here, subsequent dotenv.config() calls (e.g. inside app.ts)
// will leave them alone. With them empty, email.ts reads them as falsy and
// hits its built-in noop path. Without this, every integration test that
// books a slot would POST to EmailJS and burn quota.
process.env.EMAILJS_SERVICE_ID = "";
process.env.EMAILJS_TEMPLATE_ID = "";
process.env.EMAILJS_PUBLIC_KEY = "";
process.env.EMAILJS_PRIVATE_KEY = "";
