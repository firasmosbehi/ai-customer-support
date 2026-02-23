import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/create-org");
  }

  const organizationName = (membership.organizations as { name?: string } | null)?.name ?? "My Organization";

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <div className="flex-1">
        <Header organizationName={organizationName} userEmail={user.email ?? "Unknown user"} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
