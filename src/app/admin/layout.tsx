import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = {
  title: {
    template: "%s | Admin",
    default: "Admin",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: middleware already guards /admin, but admin pages
  // server-render data, so verify the session here too. A middleware
  // bypass then can't leak admin data — it falls through to /login.
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col lg:flex-row bg-[var(--black)] text-[var(--white)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  );
}
