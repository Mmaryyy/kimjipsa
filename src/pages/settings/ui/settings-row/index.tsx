import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

interface Props {
  label: ReactNode;
  odId?: string;
  href?: ComponentProps<typeof Link>["href"];
  action?: ReactNode;
}

const rowClassName = "flex min-h-11 items-center justify-between gap-3";

const SettingsRow = ({ label, odId, href, action }: Props) => {
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
    <Link href={href} data-od-id={odId} className={rowClassName}>
      {content}
    </Link>
  );
};

export default SettingsRow;
