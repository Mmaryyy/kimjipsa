import { EmptyState, PageLayout } from "@/shared/ui";
import { Briefcase } from "lucide-react";

const ProjectsPage = () => (
  <PageLayout width="narrow" header={{ title: "프로젝트" }} odId="prj-projects">
    <div data-od-id="prj-project-empty">
      <EmptyState
        message="아직 프로젝트가 없어요."
        icon={<Briefcase size={36} />}
      />
    </div>
  </PageLayout>
);

export default ProjectsPage;
