"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  itineraryInput,
  type ItineraryInput,
  type ProjectItinerary,
} from "@/entities/project";
import { FormField } from "@/shared/ui";
import ProjectDateControl from "../project-date-control";
import ProjectFormSheet from "../project-form-sheet";

const Field = FormField<ItineraryInput>;
const emptyItinerary: ItineraryInput = {
  starts_on: null,
  ends_on: null,
  place: "",
  title: "",
  links: [],
  memo: "",
};

function ItineraryEditor({
  projectId,
  itinerary,
  onClose,
}: {
  projectId: string;
  itinerary?: ProjectItinerary;
  onClose: () => void;
}) {
  const form = useForm<ItineraryInput>({
    resolver: zodResolver(itineraryInput),
    defaultValues: itinerary ?? emptyItinerary,
  });

  return (
    <ProjectFormSheet
      form={form}
      title={itinerary ? "일정표 수정" : "일정표 추가"}
      odId="prj-itinerary-editor"
      onClose={onClose}
      command={(item) => ({
        action: "save_itinerary",
        projectId,
        id: itinerary?.id,
        item,
      })}
      deletion={
        itinerary && {
          command: { action: "delete_itinerary", projectId, id: itinerary.id },
          name: itinerary.title,
          description: "프로젝트에서 이 일정표 항목을 삭제해요.",
        }
      }
    >
      <Field
        name="starts_on"
        label="날짜 (필수)"
        render={(field) => <ProjectDateControl {...field} label="날짜" />}
      />
      <Field
        name="ends_on"
        label="종료일"
        render={(field) => <ProjectDateControl {...field} label="종료일" />}
      />
      <Field name="place" label="장소" inputProps={{ maxLength: 1000 }} />
      <Field name="title" label="내용" inputProps={{ maxLength: 100 }} />
      <Field
        name="links"
        label="링크"
        type="textarea"
        inputProps={{ rows: 2 }}
        format={(links) => links.join("\n")}
        parse={(text) => text.split("\n")}
        hint="링크가 여러 개면 줄을 나눠 입력해 주세요."
      />
      <Field
        name="memo"
        label="메모"
        type="textarea"
        inputProps={{ maxLength: 1000 }}
      />
    </ProjectFormSheet>
  );
}

export default ItineraryEditor;
