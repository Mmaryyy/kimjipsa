import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  value: string;
}
const ChatTime = ({ value }: Props) => (
  <time dateTime={value} className="text-caption-sm text-muted-foreground">
    {format(new Date(value), "a h:mm", {
      locale: ko,
      in: tz("Asia/Seoul"),
    })}
  </time>
);
export default ChatTime;
