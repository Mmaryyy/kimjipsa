import {
  LegalDocumentContent,
  legalDocumentTitles,
  type LegalDocumentKind,
} from "@/entities/legal-document";
import { PageHeader } from "@/shared/ui";

export function LegalPage({ kind }: { kind: LegalDocumentKind }) {
  return (
    <article className="grid gap-5">
      <PageHeader title={legalDocumentTitles[kind]} />
      <LegalDocumentContent kind={kind} />
    </article>
  );
}
export function TermsPage() {
  return <LegalPage kind="terms" />;
}
export function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
