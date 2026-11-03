import {
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib";
import PageHeader from "../page-header";
import { pageLayoutStyles } from "./page-layout.variants";

type PageHeaderProps = ComponentProps<typeof PageHeader>;
interface Props {
  width: "wide" | "narrow";
  header?: PageHeaderProps | ReactElement | false;
  children?: ReactNode;
  odId?: string;
  className?: string;
}

const PageLayout = ({ width, header, children, odId, className }: Props) => {
  let pageHeader = null;
  if (header) {
    pageHeader = isValidElement(header) ? header : <PageHeader {...header} />;
  }
  return (
    <div
      className={cn(pageLayoutStyles({ width }), className)}
      data-od-id={odId}
    >
      {pageHeader}
      {children}
    </div>
  );
};

export default PageLayout;
