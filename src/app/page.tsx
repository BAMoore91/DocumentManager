import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/super-admin");
  if (session.user.role === "ORG_ADMIN") redirect("/admin");
  redirect("/dashboard");
}
