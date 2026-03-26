import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = {
  title: {
    template: "%s | Admin",
    default: "Admin",
  },
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col lg:flex-row bg-[var(--black)] text-[var(--white)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto min-h-0">{children}</div>
    </div>
  );
}
