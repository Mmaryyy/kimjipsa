import { ProjectLists } from "@/pages/project";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; listId: string }>;
}) {
  const { id, listId } = await params;
  return <ProjectLists id={id} listId={listId} />;
}
