import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

interface Props {
  label: ReactNode;
  odId?: string;
  href?: ComponentProps<typeof Link>["href"];
  onNavigate?: ComponentProps<typeof Link>["onNavigate"];
  action?: ReactNode;
}

const rowClassName = "flex min-h-11 items-center justify-between gap-3";

const SettingsRow = ({ label, odId, href, onNavigate, action }: Props) => {
  const content = (
    <>
      {label}
      {action}
    </>
  );

  if (!href)
    return (
      <div data-od-id={odId} className={rowClassName}>
        {content}
      </div>
    );

  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      data-od-id={odId}
      className={rowClassName}
    >
      {content}
    </Link>
  );
};

export default SettingsRow;
