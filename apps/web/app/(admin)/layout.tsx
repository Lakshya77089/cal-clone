import { Sidebar } from "@/components/admin/sidebar";
import { api } from "@/lib/api";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let me: { name: string; username: string } | null = null;
  try {
    const data = await api.me();
    me = { name: data.name, username: data.username };
  } catch {
    me = null;
  }
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar me={me} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
