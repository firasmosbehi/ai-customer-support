import { PagePlaceholder } from "@/components/dashboard/PagePlaceholder";

export default function ConversationDetailPage({ params }: { params: { id: string } }) {
  return (
    <PagePlaceholder
      title={`Conversation ${params.id}`}
      description="Detailed thread view and human response tools will be implemented in later phases."
    />
  );
}
