# UniVA Fork Current State

This document describes the **current implementation state** of Tom's fork of UniVA as of the `feat/univa-ai-video-mvp` branch.

## Repository / branch
- Fork: `https://github.com/thomas-nicholson/univa`
- Working branch: `feat/univa-ai-video-mvp`
- Base upstream branch used during this session: `main`

## Fork goal
This fork is being turned into an **MVP AI-assisted video editor** built on top of the existing UniVA app, with these product constraints:

1. **Use UniVA as the base app**
2. **Use fal.ai heavily for generation APIs**
3. **Integrate HyperFrames as a CLI composition/render companion**
4. **Use Gemini for strong video understanding / review / critique**
5. **Support human-in-the-loop workflows**
   - big AI steps should be proposed and approved
   - everything the AI can do should also be manually doable by the user
6. **Support both 16:9 and 9:16 workflows** for YouTube and vertical platforms

---

## What has been implemented in this fork

## 1. Product / planning documentation
The following fork-specific docs were added earlier in this branch:
- `docs/product-strategy.md`
- `docs/technical-roadmap.md`
- `docs/univa-mvp-implementation-plan.md`
- `docs/ai-assisted-video-editor-mvp.md`

These docs establish the direction of UniVA as an AI-assisted video editor rather than only a general video agent.

## 2. Config and hardcoded-path cleanup
The fork introduced centralized config work across:
- `.env.example`
- `univa/config/config.py`
- `univa/config/mcp_tools_config/config.yaml`
- `univa/config/mcp_configs.json`

### Key runtime/config concepts now present
- `FAL_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `MEDIA_DEFAULT_PROVIDER`
- `IMAGE_PROVIDER`
- `VIDEO_PROVIDER`
- `AUDIO_PROVIDER`
- `EDIT_PROVIDER`
- `VIDEO_UNDERSTANDING_PROVIDER`
- `HYPERFRAMES_CMD`
- `OUTPUT_ROOT`
- optional local VACE-related variables

This work reduced several machine-specific or hardcoded assumptions.

## 3. fal.ai integration foundation
The fork added reusable fal integration utilities and started provider abstraction for media tasks.

Important files:
- `univa/utils/fal_api.py`
- `univa/utils/runtime.py`
- `univa/mcp_tools/image_gen.py`
- `univa/mcp_tools/video_gen.py`
- `univa/mcp_tools/audio_gen.py`

Current direction:
- fal is the primary provider for generation tasks
- fallback providers can still exist where useful

## 4. HyperFrames integration foundation
Important files:
- `univa/utils/hyperframes_cli.py`
- `univa/mcp_tools/hyperframes_cli.py`

This establishes a controlled path for calling HyperFrames through UniVA, intended for deterministic composition/render-oriented tasks.

## 5. Gemini-native video understanding
Important files:
- `univa/utils/gemini_api.py`
- `univa/mcp_tools/video_understanding.py`
- `univa/utils/fal_api.py`

### Current behavior
`video_understanding.py` now resolves a provider path for video analysis:
1. **Gemini** (default)
2. **fal video understanding** (fallback)
3. older multimodal/frame-sampling route (final fallback)

### Gemini implementation details
The Gemini path is not just frame-sampling. It uses the **Gemini Files API** flow:
- upload video
- poll file status until `ACTIVE`
- call `generateContent`
- return textual analysis
- delete uploaded Gemini file when done

### Default settings
Current config defaults were changed to:
- `VIDEO_UNDERSTANDING_PROVIDER=gemini`
- default video understanding model: `gemini-2.0-flash`

## 6. Editor action pipeline scaffolding
Important frontend files:
- `apps/web/src/types/ai-editor.ts`
- `apps/web/src/lib/ai/editor-actions.ts`
- `apps/web/src/lib/ai/apply-editor-action.ts`
- `apps/web/src/components/chat/useChat.ts`
- `apps/web/src/components/chat/types.ts`
- `apps/web/src/types/project.ts`
- `apps/web/src/lib/storage/storage-service.ts`

### What exists now
The frontend can now recognize structured AI editor actions and apply early-stage actions into the project.

Implemented action types are aimed at supporting:
- import media
- insert at playhead
- append to timeline
- replace selected clip
- create text overlay

### Important note
This is still **foundational**, not a complete polished workflow.
The major missing layer is a proper **human approval UI** around these proposed actions.

## 7. Project AI history / provenance scaffolding
Project metadata now has support for richer AI-related records, including AI jobs and action results.
This is intended to support recoverability and provenance rather than purely ephemeral chat behavior.

## 8. Aspect ratio persistence for YouTube / vertical workflows
Important files:
- `apps/web/src/components/editor/media-panel/views/settings.tsx`
- `apps/web/src/stores/project-store.ts`
- `apps/web/src/lib/storage/storage-service.ts`
- `apps/web/src/types/project.ts`

### Current status
UniVA already had canvas presets including:
- `16:9`
- `9:16`
- `1:1`
- `4:3`

The missing piece was persistence. That is now implemented.

### What now works
A user can set aspect ratio in editor settings and that ratio is now saved on the project and restored when reopening the project.

This makes the app materially more usable for:
- YouTube (`16:9`)
- TikTok / Shorts / Reels (`9:16`)

---

## What is functional enough today

## Reasonably usable / present
- existing editor shell
- timeline UI
- preview panel
- export dialog
- aspect ratio selection and persistence
- project storage
- AI chat surface
- early AI action plumbing
- backend media-provider work
- Gemini-backed video understanding path

## Still incomplete for a strong creator MVP
- approval-driven AI edit suggestions UI
- robust structured action protocol end-to-end from backend to UI
- polished rough-cut workflow
- strong caption/subtitle workflow
- native short-form tooling (safe areas, caption-safe placement, hook-first templates)
- native YouTube tooling (lower-thirds, chaptering, end cards, CTA patterns)
- HyperFrames finishing workflow fully connected to editor state
- broader validation / integration tests

---

## Recommended next steps

## Highest-value next product step
Implement:
**Gemini review -> structured edit recommendations -> human approval -> apply changes**

That would move the app from “AI chat inside editor” toward a real AI-assisted editor.

## Suggested follow-up priorities
1. Human approval surface for AI edit proposals
2. Structured recommendation schema from Gemini analysis
3. Caption / subtitle workflow
4. HyperFrames-based finishing/render flow
5. Short-form mobile-safe editing helpers
6. More verification and integration testing

---

## Validation status
During this session, several targeted validations were run:
- Python compile validation on key backend modules
- import validation for `video_understanding.py` under UniVA-style PYTHONPATH
- targeted diff review and runtime reasoning for frontend changes

### Important limitation
A full live Gemini end-to-end runtime verification was **not fully completed** in the repo shell session because the Python process used in that context did not have a usable Gemini API key visible at runtime.

The implementation is in place, but future work should re-run a live smoke test once the key is available to the Python runtime that is executing UniVA.

---

## Feature-branch commit history from this work
Key commits made during this session:
- `aec6649` — `feat: add fal.ai and hyperframes mvp foundations`
- `8329d8e` — `feat: add editor actions and gemini video understanding`
- `a56186f` — `feat: persist project aspect ratio settings`

---

## Summary
This fork is no longer just stock UniVA.
It is partway through a transformation into a **creator-oriented AI-assisted video editor** with:
- fal-based generation,
- HyperFrames integration,
- Gemini-native video understanding,
- project-level AI state,
- early editor-action wiring,
- and persistent 16:9 / 9:16 support.

It is a solid foundation, but not yet a finished creator-ready MVP.
