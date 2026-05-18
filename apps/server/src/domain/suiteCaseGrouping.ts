import { sortSectionsDepthFirst } from "./sectionTreeOrder.js";

export type SuiteCaseGroupBy = "section_id" | "priority" | "type" | "none";

export type SuiteCaseGroupRow<TCase> = {
  groupKey: string;
  groupLabel: string;
  sectionId: bigint | null;
  sectionName: string | null;
  displayOrder: number;
  parentSectionId: bigint | null;
  cases: TCase[];
};

type SectionRef = {
  id: bigint;
  name: string;
  displayOrder: number;
  parentSectionId: bigint | null;
};

type CaseRef = {
  sectionId: bigint;
  priority?: string | null;
  caseType?: string | null;
};

const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const typeOrder: Record<string, number> = { Functional: 0, Integration: 1, Regression: 2 };

function labelForPriority(value: string | null | undefined) {
  const x = (value ?? "medium").trim().toLowerCase();
  if (x.length === 0) return "Unset priority";
  if (x === "low") return "Low";
  if (x === "high") return "High";
  if (x === "medium") return "Medium";
  return value!.trim();
}

function labelForType(value: string | null | undefined) {
  const x = (value ?? "functional").trim().toLowerCase();
  if (x.length === 0) return "Unset type";
  if (x === "integration") return "Integration";
  if (x === "regression") return "Regression";
  if (x === "functional") return "Functional";
  return value!.trim();
}

export function buildSuiteCaseGroups<TCase extends CaseRef>(
  cases: TCase[],
  sections: SectionRef[],
  groupBy: SuiteCaseGroupBy
): { groupBy: SuiteCaseGroupBy; groups: SuiteCaseGroupRow<TCase>[] } {
  if (groupBy === "none") {
    return {
      groupBy,
      groups:
        cases.length > 0
          ? [
              {
                groupKey: "all",
                groupLabel: "",
                sectionId: null,
                sectionName: null,
                displayOrder: 0,
                parentSectionId: null,
                cases
              }
            ]
          : []
    };
  }

  if (groupBy === "priority" || groupBy === "type") {
    const bucket = new Map<string, TCase[]>();
    for (const row of cases) {
      const label = groupBy === "priority" ? labelForPriority(row.priority) : labelForType(row.caseType);
      const list = bucket.get(label);
      if (list) list.push(row);
      else bucket.set(label, [row]);
    }
    const sortKeys =
      groupBy === "priority"
        ? (left: string, right: string) => (priorityOrder[left] ?? 99) - (priorityOrder[right] ?? 99)
        : (left: string, right: string) => (typeOrder[left] ?? 99) - (typeOrder[right] ?? 99);

    const groups = Array.from(bucket.entries())
      .sort(([left], [right]) => sortKeys(left, right))
      .map(([label, groupCases], index) => ({
        groupKey: `${groupBy}-${label}`,
        groupLabel: label,
        sectionId: null,
        sectionName: null,
        displayOrder: index,
        parentSectionId: null,
        cases: groupCases
      }));

    return { groupBy, groups };
  }

  const sectionById = new Map(sections.map((section) => [section.id.toString(), section]));
  const groupMap = new Map<string, TCase[]>();
  for (const row of cases) {
    const key = row.sectionId.toString();
    const bucket = groupMap.get(key);
    if (bucket) bucket.push(row);
    else groupMap.set(key, [row]);
  }

  const sectionOrder = sortSectionsDepthFirst(
    sections.map((section) => ({
      id: section.id,
      parentSectionId: section.parentSectionId,
      displayOrder: section.displayOrder
    }))
  );
  const sectionRank = new Map(sectionOrder.map((section, index) => [section.id.toString(), index]));

  const groups = Array.from(groupMap.entries())
    .map(([sectionId, groupCases]) => {
      const section = sectionById.get(sectionId);
      return {
        groupKey: `section-${sectionId}`,
        groupLabel: section?.name ?? `Section ${sectionId}`,
        sectionId: BigInt(sectionId),
        sectionName: section?.name ?? `Section ${sectionId}`,
        displayOrder: section?.displayOrder ?? 0,
        parentSectionId: section?.parentSectionId ?? null,
        cases: groupCases
      };
    })
    .sort(
      (left, right) =>
        (sectionRank.get(left.sectionId!.toString()) ?? Number.MAX_SAFE_INTEGER) -
        (sectionRank.get(right.sectionId!.toString()) ?? Number.MAX_SAFE_INTEGER)
    );

  return { groupBy: "section_id", groups };
}
