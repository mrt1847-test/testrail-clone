export type SectionSummary = {
  id: bigint;
  suiteId: bigint;
  parentSectionId: bigint | null;
  name: string;
};
