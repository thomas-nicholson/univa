# Future Agent Handoff

This document is meant for a future coding agent continuing work on Tom's UniVA fork.

## Start here
Before changing code, read these in order:
1. `docs/fork-current-state.md`
2. `docs/product-strategy.md`
3. `docs/technical-roadmap.md`
4. `docs/univa-mvp-implementation-plan.md`
5. `docs/ai-assisted-video-editor-mvp.md`

---

## The fork's actual direction
Do **not** treat this repository as a generic research-agent repo for future work.
For this fork, the working direction is:

- UniVA is the **base app**
- the target product is an **AI-assisted video editor**
- fal.ai is the primary generation stack
- HyperFrames is the composition/render companion
- Gemini is preferred for video understanding / critique
- major AI workflow steps should be **human-approved**
- anything AI can do should also be manually possible in the UI

If you need a one-line product definition:
> UniVA should become a creator-facing AI copilot for building YouTube and vertical videos inside a timeline editor.

---

## High-value files to understand first

## Backend / config
- `univa/config/config.py`
- `univa/config/mcp_tools_config/config.yaml`
- `.env.example`
- `univa/utils/runtime.py`
- `univa/utils/fal_api.py`
- `univa/utils/gemini_api.py`
- `univa/utils/hyperframes_cli.py`

## Video understanding
- `univa/mcp_tools/video_understanding.py`
- `univa/utils/query_llm.py`  *(legacy fallback path only)*

## Frontend editor action path
- `apps/web/src/types/ai-editor.ts`
- `apps/web/src/lib/ai/editor-actions.ts`
- `apps/web/src/lib/ai/apply-editor-action.ts`
- `apps/web/src/components/chat/useChat.ts`
- `apps/web/src/components/chat/types.ts`

## Project / persistence / aspect ratio
- `apps/web/src/types/project.ts`
- `apps/web/src/stores/project-store.ts`
- `apps/web/src/lib/storage/storage-service.ts`
- `apps/web/src/stores/editor-store.ts`
- `apps/web/src/components/editor/media-panel/views/settings.tsx`
- `apps/web/src/components/export/VideoExportDialog.tsx`

---

## Critical implementation facts

## 1. Gemini video understanding is now the intended default
The current fork prefers:
- `provider = gemini`
- `model = gemini-2.0-flash`
for video understanding.

The Gemini path uses native video upload + file activation polling, not only sampled frames.

## 2. Do not accidentally re-break `video_understanding.py`
A real issue was found during this session:
- eager import of `utils.query_llm`
- which eagerly imported `decord`
- which was not installed in the validation environment
- causing module import failure even when Gemini was intended to be the active provider

### Rule
Keep legacy fallback imports **lazy** unless you are sure all old dependencies are always available.

## 3. Aspect ratio support already exists in the editor
Do **not** re-implement basic 16:9 / 9:16 support from scratch.
The presets already existed.
The key fix was persistence on the project.

Current expected behavior:
- set aspect ratio in Settings
- save project
- reopen project
- preview/export still use the selected size

## 4. The editor action pipeline is foundational, not finished
There is early support for AI actions, but this is not a complete production workflow.
The next agent should avoid overstating what is done.

Missing important layer:
- proposal/approval UX before major AI actions run

---

## What to do next if continuing product work

### Best next feature
Implement a **review-and-approve AI editing loop**:
1. analyze draft with Gemini
2. return structured recommendations
3. show proposed edits in UI
4. require human approval
5. apply approved actions to timeline/project

### Strong next supporting features
- caption/subtitle workflow
- short-form mobile-safe layout helpers
- HyperFrames finishing flow from project state
- richer project/version/job provenance
- better tests around config and action parsing

---

## Workflow expectations for future agents
Tom asked that work **not stay only local**.

### Expected workflow
- commit regularly on the feature branch
- push regularly to GitHub
- do not let a large amount of work accumulate only in the local working tree

At the time this doc was written, the active branch was:
- `feat/univa-ai-video-mvp`

---

## Things to verify before claiming something works
Future agents should prefer verification over assumption, especially for:
- Gemini API live execution
- fal generation paths
- HyperFrames invocation
- frontend action application behavior
- export behavior across 16:9 and 9:16 projects

### Especially re-test
- Gemini key visibility in the Python runtime that actually launches UniVA
- upload/poll/cleanup behavior for Gemini Files API
- full editor reopen flow for project canvas persistence

---

## What not to lose sight of
This fork is trying to become useful for actual creators, especially:
- YouTube editing
- TikTok / Shorts / Reels editing

That means the product should optimize for:
- speed to rough cut
- intelligible AI suggestions
- human control
- reproducibility
- clear project state
- practical export outcomes

If a future change makes the system more autonomous but less controllable, that is probably moving in the wrong direction for this fork.
