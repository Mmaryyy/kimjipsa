import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { ProjectEventAction } from "@/features/project-edit";
import { cn } from "@/shared/lib";
import { StatusBadge, TextButton } from "@/shared/ui";
import type { itineraryTimeline } from "./itinerary.utils";

interface Props {
  entry: ReturnType<typeof itineraryTimeline>["days"][number];
  index: number;
  current: boolean;
  projectId: string;
  onEdit: (id: string) => void;
}

const ProjectItineraryDay = ({
  entry,
  index,
  current,
  projectId,
  onEdit,
}: Props) => {
  const { day, entries, bookings, empty, continued } = entry;
  const caption = `${index + 1}일차 · ${format(day, "EEE", { locale: ko })}`;
  const emptyCaption = continued ? `${continued.title} 이어서` : "일정 없음";

  return (
    <>
      <p
        className={cn(
          "flex flex-wrap items-center gap-x-2",
          empty
            ? "text-caption text-label-tertiary"
            : "text-caption-sm font-medium text-muted-foreground",
        )}
      >
        <span className="min-w-0 truncate">
          {caption}
          {empty && ` · ${emptyCaption}`}
        </span>
        {current && <StatusBadge variant="progress">오늘</StatusBadge>}
      </p>
      {entries.map((row) => {
        const end =
          row.ends_on && row.ends_on !== row.starts_on
            ? `${format(parseISO(row.ends_on), "M.d")}까지`
            : "";
        const details = [row.place, end, row.memo].filter(Boolean).join(" · ");
        return (
          <div
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2"
          >
            <TextButton
              size="touch"
              tone="neutral"
              className="min-w-0 flex-col items-start gap-0 py-1 text-left whitespace-normal"
              data-od-id={`prj-itinerary-${row.id}`}
              onClick={() => onEdit(row.id)}
            >
              <span className="text-body font-semibold wrap-anywhere">
                {row.title}
              </span>
              {details && (
                <span className="w-full truncate text-caption text-muted-foreground">
                  {details}
                </span>
              )}
            </TextButton>
            <ProjectEventAction row={row} source="itinerary" />
            {row.links.map((link, index) => (
              <TextButton
                asChild
                key={index}
                size="sm"
                className="col-start-1 justify-self-start"
              >
                <a href={link} target="_blank" rel="noreferrer">
                  링크{row.links.length > 1 ? ` ${index + 1}` : ""} ↗
                </a>
              </TextButton>
            ))}
          </div>
        );
      })}
      {bookings.map((row) => (
        <p
          key={row.id}
          className="text-caption wrap-anywhere text-muted-foreground tabular-nums"
        >
          예약{" "}
          <Link
            href={`/projects/${projectId}/reservations`}
            className="font-medium text-foreground"
          >
            {row.title}
          </Link>
          {row.ends_on &&
            row.ends_on !== row.starts_on &&
            ` ${format(day, "M.d")} – ${format(parseISO(row.ends_on), "M.d")}`}
        </p>
      ))}
    </>
  );
};

export default ProjectItineraryDay;
