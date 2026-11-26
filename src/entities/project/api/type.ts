import { z } from "zod";
import {
  candidateVotes,
  projectListInput,
  projectListItemInput,
} from "../model/project-list.schema";
import {
  areaInput,
  areaSortOrder,
  decisionInput,
  decisionReactions,
  expenseFields,
  reservationInput,
  itineraryInput,
  opinionInput,
  milestoneInput,
  projectId,
  projectInput,
  taskInput,
} from "../model/project.schema";

const identity = { id: projectId };
const childIdentity = { ...identity, project_id: projectId };

export const projectRow = projectInput.safeExtend({
  ...identity,
  budget_limit: z.number().nonnegative().nullable(),
});
export const areaRow = areaInput.extend({
  ...childIdentity,
  sort_order: areaSortOrder,
});
const eventLink = { event_id: projectId.nullable() };
export const milestoneRow = milestoneInput.safeExtend({
  ...childIdentity,
  ...eventLink,
});
export const decisionRow = decisionInput.extend({
  ...childIdentity,
  opinions: z.array(
    opinionInput.extend({
      id: projectId,
      user_id: projectId.nullable(),
      reactions: z
        .array(
          z.object({
            user_id: projectId,
            reaction: z.enum(decisionReactions),
          }),
        )
        .default([]),
    }),
  ),
});
export const reservationRow = reservationInput.safeExtend({
  ...childIdentity,
  ...eventLink,
});
export const itineraryRow = itineraryInput.safeExtend({
  ...childIdentity,
  ...eventLink,
  starts_on: z.iso.date(),
});
export type ProjectDecision = z.infer<typeof decisionRow>;
export type ProjectReservation = z.infer<typeof reservationRow>;
export type ProjectItinerary = z.infer<typeof itineraryRow>;
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
export const projectListEntry = z.object({
  project: projectRow,
  progress: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    percent: z.number().int().min(0).max(100),
  }),
  next: z
    .object({ title: z.string(), due_on: z.iso.date().nullable() })
    .optional(),
  overdue: z.object({
    count: z.number().int().nonnegative(),
    oldestDays: z.number().int().nonnegative(),
  }),
});
export type ProjectListEntry = z.infer<typeof projectListEntry>;
export type ProjectList = { familyId: string; entries: ProjectListEntry[] };
export const projectListRow = projectListInput.safeExtend({
  ...childIdentity,
  sort_order: areaSortOrder,
});
export const projectListItemRow = projectListItemInput.safeExtend({
  ...identity,
  list_id: projectId,
  sort_order: areaSortOrder,
});
export const candidateRecipientRow = z.object({
  list_id: projectId,
  candidate_id: projectId,
  person_id: projectId,
});
export const candidateVoteRow = z.object({
  candidate_id: projectId,
  user_id: projectId,
  vote: z.enum(candidateVotes),
});
export type CandidateRecipient = z.infer<typeof candidateRecipientRow>;
export type CandidateVote = z.infer<typeof candidateVoteRow>;

export const projectPhotoRow = z.object({
  ...identity,
  item_id: projectId,
});
export type ProjectListDefinition = z.infer<typeof projectListRow>;
export type ProjectListItem = z.infer<typeof projectListItemRow>;
export type ProjectPhoto = z.infer<typeof projectPhotoRow>;

export const expenseRow = expenseFields.extend(childIdentity);
export type ProjectExpense = z.infer<typeof expenseRow>;

export type ProjectDetail = {
  familyId: string;
  project: Project;
  areas: ProjectArea[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
  decisions: ProjectDecision[];
  reservations: ProjectReservation[];
  itinerary: ProjectItinerary[];
  lists: ProjectListDefinition[];
  listItems: ProjectListItem[];
  photos: ProjectPhoto[];
  candidateRecipients: CandidateRecipient[];
  candidateVotes: CandidateVote[];
  expenses: ProjectExpense[];
};
