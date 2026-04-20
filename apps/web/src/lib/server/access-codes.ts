import { randomBytes } from "node:crypto";

import {
  buildAccessCodeStats,
  filterAccessCodes,
  getRemainingConversations,
  mergeImportedAccessCodes,
  parseBooleanFlag,
  type AccessCodeRecord,
} from "./access-code-core";

export class AccessCodeHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AccessCodeHttpError";
  }
}

type AccessCodeRow = {
  accessCode: string;
  userId: string;
  description: string;
  createdAt: Date | string;
  enabled: boolean;
  lastUsed: Date | string | null;
  usageCount: number;
  maxConversations: number | null;
  conversationCount: number;
};

type DbModule = Awaited<typeof import("@opencut/db")>;

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function fromRow(row: AccessCodeRow): AccessCodeRecord {
  return {
    access_code: row.accessCode,
    user_id: row.userId,
    description: row.description,
    created_at: toIsoString(row.createdAt) || new Date(0).toISOString(),
    enabled: row.enabled,
    last_used: toIsoString(row.lastUsed),
    usage_count: row.usageCount,
    max_conversations: row.maxConversations,
    conversation_count: row.conversationCount,
  };
}

function authEnabled(): boolean {
  return parseBooleanFlag(process.env.AUTH_ENABLED, false);
}

function assertAdminCode(headerValue: string | null): void {
  const configuredAdminCode = process.env.ADMIN_ACCESS_CODE?.trim();
  if (!configuredAdminCode) {
    throw new AccessCodeHttpError("ADMIN_ACCESS_CODE is not configured", 503);
  }

  if (!headerValue) {
    throw new AccessCodeHttpError("Admin access code is required", 401);
  }

  if (headerValue !== configuredAdminCode) {
    throw new AccessCodeHttpError("Invalid admin access code", 403);
  }
}

function generateAccessCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

async function getDbModule(): Promise<DbModule> {
  return import("@opencut/db");
}

async function getAllAccessCodes(): Promise<AccessCodeRecord[]> {
  const { accessCodes, db } = await getDbModule();
  const rows = (await db.select().from(accessCodes)) as AccessCodeRow[];
  return rows.map(fromRow).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function requireAdminAccess(headerValue: string | null): Promise<void> {
  assertAdminCode(headerValue);
}

export async function listAccessCodes(options: {
  search?: string | null;
  enabled?: boolean | null;
  skip?: number;
  limit?: number;
}) {
  const codes = await getAllAccessCodes();
  return filterAccessCodes(codes, options);
}

export async function getAccessCode(accessCodeValue: string): Promise<AccessCodeRecord | null> {
  const { accessCodes, db, eq } = await getDbModule();
  const rows = (await db
    .select()
    .from(accessCodes)
    .where(eq(accessCodes.accessCode, accessCodeValue))
    .limit(1)) as AccessCodeRow[];

  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createAccessCode(input: {
  user_id: string;
  description?: string;
  max_conversations?: number | null;
  access_code?: string;
}) {
  const access_code = input.access_code || generateAccessCode();
  const existing = await getAccessCode(access_code);
  if (existing) {
    throw new AccessCodeHttpError("Access code already exists", 400);
  }

  const { accessCodes, db } = await getDbModule();
  await db.insert(accessCodes).values({
    accessCode: access_code,
    userId: input.user_id,
    description: input.description || "",
    maxConversations: input.max_conversations ?? null,
  });

  return {
    access_code,
    user_id: input.user_id,
    max_conversations: input.max_conversations ?? null,
  };
}

export async function updateAccessCode(
  accessCodeValue: string,
  updates: {
    description?: string;
    enabled?: boolean;
    max_conversations?: number | null;
  },
) {
  const existing = await getAccessCode(accessCodeValue);
  if (!existing) {
    throw new AccessCodeHttpError("Access code not found", 404);
  }

  const { accessCodes, db, eq } = await getDbModule();
  await db
    .update(accessCodes)
    .set({
      description: updates.description ?? existing.description,
      enabled: updates.enabled ?? existing.enabled,
      maxConversations:
        Object.prototype.hasOwnProperty.call(updates, "max_conversations")
          ? updates.max_conversations ?? null
          : existing.max_conversations,
    })
    .where(eq(accessCodes.accessCode, accessCodeValue));

  return { message: "Access code updated", access_code: accessCodeValue };
}

export async function deleteAccessCode(accessCodeValue: string) {
  const existing = await getAccessCode(accessCodeValue);
  if (!existing) {
    throw new AccessCodeHttpError("Access code not found", 404);
  }

  const { accessCodes, db, eq } = await getDbModule();
  await db.delete(accessCodes).where(eq(accessCodes.accessCode, accessCodeValue));
  return { message: "Access code deleted" };
}

export async function batchCreateAccessCodes(input: {
  count: number;
  user_id_prefix: string;
  description?: string;
  max_conversations?: number | null;
}) {
  if (input.count <= 0 || input.count > 100) {
    throw new AccessCodeHttpError("Count must be between 1 and 100", 400);
  }

  const codes = [];
  for (let index = 0; index < input.count; index += 1) {
    codes.push(
      await createAccessCode({
        user_id: `${input.user_id_prefix}_${index + 1}`,
        description: input.description,
        max_conversations: input.max_conversations ?? null,
      }),
    );
  }

  return { codes, count: codes.length };
}

export async function batchDeleteAccessCodes(accessCodeValues: string[]) {
  let deleted_count = 0;
  const errors: Array<{ code: string; error: string }> = [];

  for (const code of accessCodeValues) {
    try {
      await deleteAccessCode(code);
      deleted_count += 1;
    } catch (error) {
      errors.push({
        code,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { deleted_count, errors };
}

export async function exportAccessCodes() {
  return {
    codes: await getAllAccessCodes(),
    exported_at: new Date().toISOString(),
  };
}

export async function importAccessCodes(input: {
  codes: AccessCodeRecord[];
  overwrite: boolean;
}) {
  const existing = await getAllAccessCodes();
  const merged = mergeImportedAccessCodes(existing, input.codes, input.overwrite);
  const incomingByCode = new Map(input.codes.map((code) => [code.access_code, code]));
  const { accessCodes, db, eq } = await getDbModule();

  for (const code of merged.merged) {
    if (!incomingByCode.has(code.access_code)) {
      continue;
    }

    const current = await getAccessCode(code.access_code);
    if (current) {
      await db
        .update(accessCodes)
        .set({
          userId: code.user_id,
          description: code.description,
          createdAt: new Date(code.created_at),
          enabled: code.enabled,
          lastUsed: code.last_used ? new Date(code.last_used) : null,
          usageCount: code.usage_count,
          maxConversations: code.max_conversations,
          conversationCount: code.conversation_count,
        })
        .where(eq(accessCodes.accessCode, code.access_code));
    } else {
      await db.insert(accessCodes).values({
        accessCode: code.access_code,
        userId: code.user_id,
        description: code.description,
        createdAt: new Date(code.created_at),
        enabled: code.enabled,
        lastUsed: code.last_used ? new Date(code.last_used) : null,
        usageCount: code.usage_count,
        maxConversations: code.max_conversations,
        conversationCount: code.conversation_count,
      });
    }
  }

  return {
    imported_count: merged.imported_count,
    skipped_count: merged.skipped_count,
    errors: [],
  };
}

export async function getAccessCodeStats() {
  return buildAccessCodeStats(await getAllAccessCodes());
}

export async function getAccessCodeStatus(headerValue: string | null) {
  if (!authEnabled()) {
    return {
      enabled: true,
      usage_count: 0,
      conversation_count: 0,
      max_conversations: null,
      remaining_conversations: null,
      last_used: null,
      created_at: null,
    };
  }

  if (!headerValue) {
    throw new AccessCodeHttpError("Access code is required", 401);
  }

  const code = await getAccessCode(headerValue);
  if (!code) {
    throw new AccessCodeHttpError("Access code not found", 404);
  }

  return {
    enabled: code.enabled,
    usage_count: code.usage_count,
    conversation_count: code.conversation_count,
    max_conversations: code.max_conversations,
    remaining_conversations: getRemainingConversations(code),
    last_used: code.last_used,
    created_at: code.created_at,
  };
}

export async function validateConversationAccess(accessCodeValue: string | null) {
  if (!authEnabled()) {
    return null;
  }

  if (!accessCodeValue) {
    throw new AccessCodeHttpError("Access code not provided", 401);
  }

  const code = await getAccessCode(accessCodeValue);
  if (!code || !code.enabled) {
    throw new AccessCodeHttpError("Invalid access code", 403);
  }

  const remaining = getRemainingConversations(code);
  if (remaining !== null && remaining <= 0) {
    throw new AccessCodeHttpError("Conversation limit reached", 429);
  }

  return code;
}

export async function consumeConversation(accessCodeValue: string | null): Promise<void> {
  const code = await validateConversationAccess(accessCodeValue);
  if (!code) {
    return;
  }

  const { accessCodes, db, eq } = await getDbModule();
  await db
    .update(accessCodes)
    .set({
      usageCount: code.usage_count + 1,
      conversationCount: code.conversation_count + 1,
      lastUsed: new Date(),
    })
    .where(eq(accessCodes.accessCode, code.access_code));
}
