import { cn } from "@/shared/lib";

function ProjectProgressBar({
  label,
  done,
  total,
  className,
}: {
  label: string;
  done: number;
  total: number;
  className?: string;
}) {
  return (
    <progress
      aria-label={label}
      value={done}
      max={total || 1}
      className={cn(
        "block h-1.25 appearance-none [&::-webkit-progress-bar]:bg-muted",
        "[&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary",
        className,
      )}
    />
  );
}

export default ProjectProgressBar;
