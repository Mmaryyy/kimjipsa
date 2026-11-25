import { ProjectLists } from "@/pages/project";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const [{ id }, { kind }] = await Promise.all([params, searchParams]);
  return (
    <ProjectLists id={id} kind={kind === "people" ? "people" : "candidates"} />
  );
}
