export const legalDocumentTitles = {
  terms: "이용약관 초안",
  privacy: "개인정보 처리방침 초안",
} as const;

export type LegalDocumentKind = keyof typeof legalDocumentTitles;
