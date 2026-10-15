import { CircleAlert } from "lucide-react";
import { TextButton } from "./text-button";
import { EmptyState } from "./empty-state";
export function ErrorState({
  message = "불러오지 못했어요",
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert">
      <EmptyState
        message={message}
        icon={<CircleAlert size={36} />}
        action={
          <TextButton onClick={onRetry} disabled={retrying}>
            {retrying ? "다시 불러와요" : "다시 시도하기"}
          </TextButton>
        }
      />
    </div>
  );
}
