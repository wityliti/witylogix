import { FlowEditor } from "../_components/flow-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditActivityFlowPage({ params }: PageProps) {
  const { id } = await params;
  return <FlowEditor flowId={id} />;
}
