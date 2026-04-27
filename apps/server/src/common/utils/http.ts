import type { Ok, Paged } from "@testrail-clone/shared";

export function ok<T>(data: T) {
  return { data } satisfies Ok<T>;
}

export function paged<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  } satisfies Paged<T>;
}
