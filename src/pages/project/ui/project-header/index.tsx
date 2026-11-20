import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TextButton } from "@/shared/ui";

function ProjectBackLink({ href, label }: { href: string; label: string }) {
  return (
    <TextButton asChild size="icon">
      <Link href={href} aria-label={label}>
        <ChevronLeft size={20} aria-hidden />
      </Link>
    </TextButton>
  );
}

export default ProjectBackLink;
