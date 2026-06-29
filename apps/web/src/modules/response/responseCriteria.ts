export type ResponseCriterionDto = {
  id: number;
  parentId: number | null;
  depth: 1 | 2 | 3;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type CriterionPathItem = Pick<ResponseCriterionDto, "id" | "parentId" | "depth" | "name">;

export function criteriaByParent(criteria: ResponseCriterionDto[], parentId: number | null) {
  return criteria
    .filter((criterion) => criterion.parentId === parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function criterionPathLabel(path: CriterionPathItem[]): string {
  return path.length > 0 ? path.map((criterion) => criterion.name).join(" > ") : "-";
}
