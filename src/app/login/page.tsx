import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/session";
import LoginForm from "@/components/admin/LoginForm";

export const metadata = {
  title: "Login",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (session?.value) {
    try {
      await verifySession(session.value, process.env.JWT_SECRET!);
      redirect("/admin/dashboard");
    } catch {
      // Invalid/expired session — fall through to show login form
    }
  }

  return <LoginForm />;
}
