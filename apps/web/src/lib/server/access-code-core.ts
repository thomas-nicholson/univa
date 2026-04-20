export interface AccessCodeRecord {
  access_code: string;
  user_id: string;
  description: string;
  created_at: string;
  enabled: boolean;
  last_used: string | null;
  usage_count: number;
  max_conversations: number | null;
  conversation_count: number;
}

export interface ListAccessCodesOptions {
  search?: string | null;
  enabled?: boolean | null;
  skip?: number;
  limit?: number;
}

export interface AccessCodeStats {
  total_codes: number;
  enabled_codes: number;
  disabled_codes: number;
  limited_codes: number;
  unlimited_codes: number;
  exhausted_codes: number;
  total_usage: number;
  total_conversations: number;
  recent_used: AccessCodeRecord[];
}

export function parseBooleanFlag(value: string | undefined | null, defaultValue = false): boolean {
  if (value == null || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getRemainingConversations(code: Pick<AccessCodeRecord, "max_conversations" | "conversation_count">): number | null {
  if (code.max_conversations == null) {
    return null;
  }

  return Math.max(code.max_conversations - code.conversation_count, 0);
}

export function filterAccessCodes(
  codes: AccessCodeRecord[],
  options: ListAccessCodesOptions = {},
): { codes: AccessCodeRecord[]; total: number; skip: number; limit: number } {
  const skip = Math.max(options.skip ?? 0, 0);
  const limit = Math.max(options.limit ?? 50, 0);
  const normalizedSearch = options.search?.trim().toLowerCase();

  let filtered = [...codes];

  if (normalizedSearch) {
    filtered = filtered.filter((code) =>
      [code.access_code, code.user_id, code.description]
        .filter((value) => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }

  if (typeof options.enabled === "boolean") {
    filtered = filtered.filter((code) => code.enabled === options.enabled);
  }

  const total = filtered.length;
  return {
    codes: filtered.slice(skip, skip + limit),
    total,
    skip,
    limit,
  };
}

export function buildAccessCodeStats(codes: AccessCodeRecord[]): AccessCodeStats {
  const total_codes = codes.length;
  const enabled_codes = codes.filter((code) => code.enabled).length;
  const disabled_codes = total_codes - enabled_codes;
  const limited_codes = codes.filter((code) => code.max_conversations != null).length;
  const unlimited_codes = total_codes - limited_codes;
  const exhausted_codes = codes.filter((code) => getRemainingConversations(code) === 0).length;
  const total_usage = codes.reduce((sum, code) => sum + code.usage_count, 0);
  const total_conversations = codes.reduce((sum, code) => sum + code.conversation_count, 0);

  const recent_used = [...codes]
    .filter((code) => Boolean(code.last_used))
    .sort((a, b) => (b.last_used || "").localeCompare(a.last_used || ""))
    .slice(0, 10);

  return {
    total_codes,
    enabled_codes,
    disabled_codes,
    limited_codes,
    unlimited_codes,
    exhausted_codes,
    total_usage,
    total_conversations,
    recent_used,
  };
}

export function mergeImportedAccessCodes(
  existing: AccessCodeRecord[],
  incoming: AccessCodeRecord[],
  overwrite: boolean,
): {
  merged: AccessCodeRecord[];
  imported_count: number;
  skipped_count: number;
} {
  const byCode = new Map(existing.map((code) => [code.access_code, code]));
  let imported_count = 0;
  let skipped_count = 0;

  for (const code of incoming) {
    const current = byCode.get(code.access_code);
    if (current && !overwrite) {
      skipped_count += 1;
      continue;
    }

    byCode.set(code.access_code, code);
    imported_count += 1;
  }

  return {
    merged: Array.from(byCode.values()),
    imported_count,
    skipped_count,
  };
}
