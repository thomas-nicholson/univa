import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTodoProgress,
  extractJsonObject,
  normalizeTypeScriptAgentPayload,
} from "./typescript-agent-core";

test("extractJsonObject pulls fenced JSON payloads out of model output", () => {
  const json = extractJsonObject('Before\n```json\n{"assistant_message":"hello"}\n```\nAfter');
  assert.equal(json, '{"assistant_message":"hello"}');
});

test("normalizeTypeScriptAgentPayload accepts structured action payloads", () => {
  const payload = normalizeTypeScriptAgentPayload(`{
    "assistant_message": "Added a title card.",
    "summary": "Create overlay",
    "editor_actions": [
      {
        "type": "create_text_overlay",
        "title": "Hook",
        "text": "Big idea",
        "startTime": 0,
        "duration": 3
      }
    ]
  }`);

  assert.equal(payload.assistantMessage, "Added a title card.");
  assert.equal(payload.summary, "Create overlay");
  assert.equal(payload.editorActions.length, 1);
  assert.equal(payload.editorActions[0]?.action.type, "create_text_overlay");
  assert.equal(payload.editorActions[0]?.action.title, "Hook");
});

test("normalizeTypeScriptAgentPayload falls back to plain text when JSON is absent", () => {
  const payload = normalizeTypeScriptAgentPayload("Just respond normally.");
  assert.equal(payload.assistantMessage, "Just respond normally.");
  assert.deepEqual(payload.editorActions, []);
});

test("buildTodoProgress returns UI-compatible progress items", () => {
  const progress = buildTodoProgress("Trim the intro and add a title");
  assert.match(progress.overall_description, /Trim the intro/);
  assert.equal(progress.items.length, 3);
  assert.equal(progress.items[1]?.status, "in_progress");
});
