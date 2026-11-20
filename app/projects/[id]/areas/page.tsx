import { ProjectAreas } from "@/pages/project";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectAreas id={id} />;
}
