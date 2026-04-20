import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAccessCodeStats,
  filterAccessCodes,
  getRemainingConversations,
  mergeImportedAccessCodes,
  parseBooleanFlag,
  type AccessCodeRecord,
} from "./access-code-core";

const sampleCodes: AccessCodeRecord[] = [
  {
    access_code: "AAA111",
    user_id: "tom",
    description: "Primary creator",
    created_at: "2026-04-20T08:00:00.000Z",
    enabled: true,
    last_used: "2026-04-20T09:00:00.000Z",
    usage_count: 5,
    max_conversations: 10,
    conversation_count: 4,
  },
  {
    access_code: "BBB222",
    user_id: "guest",
    description: "Guest trial",
    created_at: "2026-04-19T08:00:00.000Z",
    enabled: false,
    last_used: null,
    usage_count: 1,
    max_conversations: 1,
    conversation_count: 1,
  },
  {
    access_code: "CCC333",
    user_id: "studio",
    description: "Unlimited studio seat",
    created_at: "2026-04-18T08:00:00.000Z",
    enabled: true,
    last_used: "2026-04-18T10:00:00.000Z",
    usage_count: 9,
    max_conversations: null,
    conversation_count: 9,
  },
];

test("parseBooleanFlag accepts common truthy strings", () => {
  assert.equal(parseBooleanFlag("true"), true);
  assert.equal(parseBooleanFlag("YES"), true);
  assert.equal(parseBooleanFlag("0"), false);
  assert.equal(parseBooleanFlag(undefined, true), true);
});

test("getRemainingConversations clamps at zero and supports unlimited codes", () => {
  assert.equal(getRemainingConversations(sampleCodes[0]), 6);
  assert.equal(getRemainingConversations(sampleCodes[1]), 0);
  assert.equal(getRemainingConversations(sampleCodes[2]), null);
});

test("filterAccessCodes filters by search and enabled state with pagination", () => {
  const filtered = filterAccessCodes(sampleCodes, {
    search: "guest",
    enabled: false,
    skip: 0,
    limit: 10,
  });

  assert.equal(filtered.total, 1);
  assert.equal(filtered.codes[0]?.access_code, "BBB222");

  const paged = filterAccessCodes(sampleCodes, { skip: 1, limit: 1 });
  assert.equal(paged.total, 3);
  assert.equal(paged.codes.length, 1);
  assert.equal(paged.codes[0]?.access_code, "BBB222");
});

test("buildAccessCodeStats derives aggregate counts", () => {
  const stats = buildAccessCodeStats(sampleCodes);

  assert.deepEqual(
    {
      total_codes: stats.total_codes,
      enabled_codes: stats.enabled_codes,
      disabled_codes: stats.disabled_codes,
      limited_codes: stats.limited_codes,
      unlimited_codes: stats.unlimited_codes,
      exhausted_codes: stats.exhausted_codes,
      total_usage: stats.total_usage,
      total_conversations: stats.total_conversations,
    },
    {
      total_codes: 3,
      enabled_codes: 2,
      disabled_codes: 1,
      limited_codes: 2,
      unlimited_codes: 1,
      exhausted_codes: 1,
      total_usage: 15,
      total_conversations: 14,
    },
  );

  assert.equal(stats.recent_used[0]?.access_code, "AAA111");
});

test("mergeImportedAccessCodes skips duplicates unless overwrite is enabled", () => {
  const incoming: AccessCodeRecord[] = [
    {
      ...sampleCodes[0],
      description: "Updated description",
    },
    {
      access_code: "DDD444",
      user_id: "new",
      description: "New code",
      created_at: "2026-04-20T10:00:00.000Z",
      enabled: true,
      last_used: null,
      usage_count: 0,
      max_conversations: 2,
      conversation_count: 0,
    },
  ];

  const withoutOverwrite = mergeImportedAccessCodes(sampleCodes, incoming, false);
  assert.equal(withoutOverwrite.imported_count, 1);
  assert.equal(withoutOverwrite.skipped_count, 1);
  assert.equal(
    withoutOverwrite.merged.find((code) => code.access_code === "AAA111")?.description,
    "Primary creator",
  );

  const withOverwrite = mergeImportedAccessCodes(sampleCodes, incoming, true);
  assert.equal(withOverwrite.imported_count, 2);
  assert.equal(withOverwrite.skipped_count, 0);
  assert.equal(
    withOverwrite.merged.find((code) => code.access_code === "AAA111")?.description,
    "Updated description",
  );
});
