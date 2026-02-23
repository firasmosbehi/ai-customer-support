import { redirect } from "next/navigation";
import { DocumentList } from "@/components/dashboard/DocumentList";
import { KnowledgeBaseTester } from "@/components/dashboard/KnowledgeBaseTester";
import { KnowledgeBaseUploader } from "@/components/dashboard/KnowledgeBaseUploader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function KnowledgeBasePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id,title,source_type,status,chunk_count,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch knowledge base documents", error);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <KnowledgeBaseUploader />
        <KnowledgeBaseTester />
      </div>
      <DocumentList documents={documents ?? []} />
    </div>
  );
}
