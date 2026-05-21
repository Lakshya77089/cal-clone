import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn&rsquo;t exist or has been removed.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
