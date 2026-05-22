export interface EmailItem {
  id: string;
  threadId?: string | null;
  sender?: string;
  subject?: string;
  date?: string;
  snippet?: string;
}

export interface FilterSortRequest {
  instructions: string;
  emails: EmailItem[];
}

export interface FilterSortResult {
  keep_ids: string[];
  ordered_ids: string[];
  summary: string;
  raw: Record<string, unknown>;
}
