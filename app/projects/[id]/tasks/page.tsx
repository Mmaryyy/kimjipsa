import { ProjectTasks } from "@/pages/project";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectTasks id={id} />;
}
