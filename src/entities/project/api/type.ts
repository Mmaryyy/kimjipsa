import { z } from "zod";
import {
  areaInput,
  areaSortOrder,
  milestoneInput,
  projectId,
  projectInput,
  taskInput,
} from "../model/project.schema";

const identity = { id: projectId };
const childIdentity = { ...identity, project_id: projectId };

export const projectRow = projectInput.safeExtend(identity);
export const areaRow = areaInput.extend({
  ...childIdentity,
  sort_order: areaSortOrder,
});
export const milestoneRow = milestoneInput.safeExtend(childIdentity);
export const taskRow = taskInput.safeExtend({
  ...childIdentity,
  completed_at: z.string().nullable(),
  completed_by: projectId.nullable(),
});

export type Project = z.infer<typeof projectRow>;
export type ProjectArea = z.infer<typeof areaRow>;
export type ProjectMilestone = z.infer<typeof milestoneRow>;
export type ProjectTask = z.infer<typeof taskRow>;
export type ProjectMember = { user_id: string; display_name: string };
export type ProjectListEntry = {
  project: Project;
  progress: { done: number; total: number; percent: number };
  next: Pick<ProjectTask, "title" | "due_on"> | undefined;
};
export type ProjectList = { familyId: string; entries: ProjectListEntry[] };
export type ProjectDetail = {
  familyId: string;
  project: Project;
  areas: ProjectArea[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
};
