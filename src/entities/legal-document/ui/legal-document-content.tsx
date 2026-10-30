import { Text } from "@/shared/ui";
import {
  legalDocuments,
  type LegalDocumentKind,
} from "../model/legal-document.constants";

export function LegalDocumentContent({ kind }: { kind: LegalDocumentKind }) {
  return (
    <div className="grid gap-5">
      {legalDocuments[kind].map(({ title, body }) => (
        <section key={title} className="grid gap-2">
          <Text as="h2" variant="title-sm">
            {title}
          </Text>
          {body.map((paragraph) => (
            <Text key={paragraph} as="p">
              {paragraph}
            </Text>
          ))}
        </section>
      ))}
    </div>
  );
}
