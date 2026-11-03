import {
  LegalDocumentContent,
  legalDocumentTitles,
  type LegalDocumentKind,
} from "@/entities/legal-document";
import { PageHeader, PageLayout } from "@/shared/ui";

export function LegalPage({ kind }: { kind: LegalDocumentKind }) {
  return (
    <PageLayout
      width="narrow"
      className="grid gap-5"
      header={
        <PageHeader title={legalDocumentTitles[kind]} titleId="legal-title" />
      }
    >
      <article className="grid gap-5" aria-labelledby="legal-title">
        <LegalDocumentContent kind={kind} />
      </article>
    </PageLayout>
  );
}
export function TermsPage() {
  return <LegalPage kind="terms" />;
}
export function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
