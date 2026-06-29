export type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};
