import { kstDate, type CalendarEvent } from "@/entities/event";
import { useConfettiBurst } from "../../model/use-confetti-burst";
import { cn } from "@/shared/lib";
import { TextButton, Text } from "@/shared/ui";
import { format } from "date-fns";
import { X } from "lucide-react";

interface Props {
  event: CalendarEvent;
  anniversary: number;
  date: string;
  onDismiss: () => void;
  dismissing: boolean;
}

const CelebrationCard = ({
  event,
  anniversary,
  date,
  onDismiss,
  dismissing,
}: Props) => {
  const bannerRef = useConfettiBurst(true);
  return (
    <article
      ref={bannerRef}
      className={cn([
        "relative overflow-hidden bg-[var(--fill-quaternary)] p-4 pt-4.5 rounded-sm",
        "lg:flex lg:min-h-[160px] lg:flex-col lg:justify-center lg:px-6",
      ])}
      aria-label={`${event.details?.title} 축하`}
    >
      <Text
        as="p"
        variant="caption"
        className="font-semibold tracking-[0.02em] text-[var(--celebrate-text)]"
      >
        오늘 · {format(kstDate(date), "yyyy년 M월 d일")}
      </Text>
      <Text as="h2" variant="title" className={cn(["mt-0.5 pr-6", "lg:mt-2"])}>
        {event.details?.title}
        {anniversary > 0 && ` ${anniversary}주년`}
      </Text>
      <Text
        as="p"
        variant="body-sm"
        className={cn(["mt-1 text-muted-foreground", "lg:mt-2.5"])}
      >
        {event.details?.celebrateMessage || "소중한 날을 축하해요!"}
      </Text>
      <TextButton
        className={cn([
          "absolute right-2 top-2 p-1 min-h-0!",
          "lg:right-4 lg:top-4",
        ])}
        aria-label="오늘 축하 닫기"
        onClick={onDismiss}
        disabled={dismissing}
      >
        <X size={18} className="text-[var(--icon-secondary)]" />
      </TextButton>
    </article>
  );
};

export default CelebrationCard;
