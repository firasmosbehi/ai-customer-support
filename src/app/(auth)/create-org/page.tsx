import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

export default async function CreateOrganizationPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingMembership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMembership) {
    redirect("/dashboard");
  }

  const createOrganization = async (formData: FormData) => {
    "use server";

    const serverSupabase = await createSupabaseServerClient();
    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser();

    if (!currentUser) {
      redirect("/login?error=session_expired");
    }

    const rawName = String(formData.get("name") ?? "").trim();
    const rawSlug = String(formData.get("slug") ?? "").trim();
    const normalizedSlug = slugify(rawSlug || rawName);

    const parsed = createOrganizationSchema.safeParse({
      name: rawName,
      slug: normalizedSlug,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? "Invalid organization details";
      redirect(`/create-org?error=${encodeURIComponent(issue)}`);
    }

    const { data: organization, error: organizationError } = await serverSupabase
      .from("organizations")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        owner_id: currentUser.id,
      })
      .select("id")
      .single();

    if (organizationError) {
      console.error("Failed to create organization", organizationError);
      const message = organizationError.code === "23505" ? "That organization slug is already taken" : "Failed to create organization";
      redirect(`/create-org?error=${encodeURIComponent(message)}`);
    }

    const { error: membershipError } = await serverSupabase.from("org_members").insert({
      org_id: organization.id,
      user_id: currentUser.id,
      role: "owner",
    });

    if (membershipError) {
      console.error("Failed to create membership", membershipError);
      redirect("/create-org?error=Failed%20to%20create%20organization%20membership");
    }

    redirect("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Set up your organization</h1>
        <p className="mt-1 text-sm text-slate-600">This creates the workspace for your support team.</p>

        <form action={createOrganization} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="name">
            Organization name
          </label>
          <input
            required
            id="name"
            name="name"
            type="text"
            placeholder="Acme Dental"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="slug">
            Workspace slug
          </label>
          <input
            required
            id="slug"
            name="slug"
            type="text"
            placeholder="acme-dental"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-offset-2 focus:border-slate-400 focus:ring-2"
          />

          {searchParams.error ? <p className="text-sm text-rose-600">{searchParams.error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Create organization
          </button>
        </form>
      </div>
    </main>
  );
}
