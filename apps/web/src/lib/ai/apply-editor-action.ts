import { mediaImporter } from "@/components/chat/utils/mediaImporter";
import { GeneratedFile } from "@/components/chat/types";
import {
  AiEditorAction,
  AiEditorActionEnvelope,
  AiEditorActionResult,
  AiJobRecord,
} from "@/types/ai-editor";
import { storageService } from "@/lib/storage/storage-service";
import { generateUUID } from "@/lib/utils";
import { MediaItem, useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";

function inferMediaTypeFromPath(filePath: string): GeneratedFile["type"] {
  const extension = filePath.split(".").pop()?.toLowerCase() || "";

  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension)) {
    return "image";
  }

  if (["wav", "mp3", "aac", "ogg", "flac"].includes(extension)) {
    return "audio";
  }

  return "video";
}

function toGeneratedFile(action: AiEditorAction): GeneratedFile {
  const filePath = action.mediaPath || "";
  return {
    path: filePath,
    type: action.mediaType || inferMediaTypeFromPath(filePath),
    name: action.title || filePath.split("/").pop() || filePath,
  };
}

async function importMediaForAction(action: AiEditorAction): Promise<MediaItem> {
  const project = useProjectStore.getState().activeProject;
  if (!project) {
    throw new Error("No active project is open");
  }

  if (!action.mediaPath) {
    throw new Error("This action requires a mediaPath");
  }

  const generatedFile = toGeneratedFile(action);
  const validation = await mediaImporter.validateFile(generatedFile);
  if (!validation.valid) {
    throw new Error(validation.error || "Generated file is not accessible");
  }

  const mediaStore = useMediaStore.getState();
  const beforeIds = new Set(mediaStore.mediaItems.map((item) => item.id));

  const importResult = await mediaImporter.importFiles(
    [generatedFile],
    mediaStore.addMediaItem,
    project.id
  );

  if (importResult.failed.length > 0) {
    throw new Error(importResult.failed[0].error);
  }

  const refreshedMediaStore = useMediaStore.getState();
  const importedItem = refreshedMediaStore.mediaItems.find((item) => !beforeIds.has(item.id));

  if (!importedItem) {
    throw new Error("Media import completed but the new item could not be located");
  }

  return importedItem;
}

async function appendAiJobRecord(
  envelope: AiEditorActionEnvelope,
  result: AiEditorActionResult
): Promise<void> {
  const projectStore = useProjectStore.getState();
  const project = projectStore.activeProject;
  if (!project) return;

  const job: AiJobRecord = {
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    prompt: envelope.prompt || envelope.summary || result.summary,
    provider: envelope.provider,
    model: envelope.model,
    status: result.ok ? "completed" : "failed",
    outputPaths: envelope.outputPaths,
    actions: [envelope.action],
    actionResults: [result],
  };

  const updatedProject = {
    ...project,
    aiJobs: [...(project.aiJobs || []), job],
    updatedAt: new Date(),
  };

  await storageService.saveProject(updatedProject);
  useProjectStore.setState((state) => ({
    ...state,
    activeProject:
      state.activeProject?.id === updatedProject.id ? updatedProject : state.activeProject,
    savedProjects: state.savedProjects.map((item) =>
      item.id === updatedProject.id ? updatedProject : item
    ),
  }));
}

export async function applyEditorAction(
  envelope: AiEditorActionEnvelope
): Promise<AiEditorActionResult> {
  const { action } = envelope;
  const timelineStore = useTimelineStore.getState();

  try {
    if (action.type === "create_text_overlay") {
      const startTime = action.startTime ?? 0;
      const duration = action.duration ?? 3;
      const title = action.title || "AI Title";
      timelineStore.addTextAtTime(
        {
          id: generateUUID(),
          type: "text",
          name: title,
          content: action.text || title,
          duration,
          startTime,
          trimStart: 0,
          trimEnd: 0,
          fontSize: 48,
          fontFamily: "Arial",
          color: "#ffffff",
          backgroundColor: "transparent",
          textAlign: "center",
          fontWeight: "bold",
          fontStyle: "normal",
          textDecoration: "none",
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
        },
        startTime
      );

      const result: AiEditorActionResult = {
        ok: true,
        action,
        summary: envelope.summary || `Created text overlay: ${title}`,
      };
      await appendAiJobRecord(envelope, result);
      return result;
    }

    const importedMedia = await importMediaForAction(action);

    if (action.type === "import_media") {
      const result: AiEditorActionResult = {
        ok: true,
        action,
        importedMediaId: importedMedia.id,
        summary: envelope.summary || `Imported ${importedMedia.name} into the media library`,
      };
      await appendAiJobRecord(envelope, result);
      return result;
    }

    if (action.type === "append_to_timeline") {
      const success = timelineStore.addMediaAtTime(
        importedMedia,
        Math.max(action.startTime ?? timelineStore.getTotalDuration(), 0)
      );
      if (!success) {
        throw new Error("Could not append the imported media to the timeline");
      }

      const result: AiEditorActionResult = {
        ok: true,
        action,
        importedMediaId: importedMedia.id,
        summary: envelope.summary || `Appended ${importedMedia.name} to the timeline`,
      };
      await appendAiJobRecord(envelope, result);
      return result;
    }

    if (action.type === "insert_at_playhead") {
      const success = timelineStore.addMediaAtTime(importedMedia, Math.max(action.startTime ?? 0, 0));
      if (!success) {
        throw new Error("Could not insert the imported media on the timeline");
      }

      const result: AiEditorActionResult = {
        ok: true,
        action,
        importedMediaId: importedMedia.id,
        summary: envelope.summary || `Inserted ${importedMedia.name} on the timeline`,
      };
      await appendAiJobRecord(envelope, result);
      return result;
    }

    if (action.type === "replace_selected_clip") {
      if (!action.trackId || !action.elementId) {
        throw new Error("replace_selected_clip requires trackId and elementId");
      }

      const replaceResult = await timelineStore.replaceElementMedia(
        action.trackId,
        action.elementId,
        importedMedia.file
      );

      if (!replaceResult.success) {
        throw new Error(replaceResult.error || "Failed to replace timeline media");
      }

      const result: AiEditorActionResult = {
        ok: true,
        action,
        importedMediaId: importedMedia.id,
        summary: envelope.summary || `Replaced the selected clip with ${importedMedia.name}`,
      };
      await appendAiJobRecord(envelope, result);
      return result;
    }

    throw new Error(`Action type ${action.type} is not implemented yet`);
  } catch (error) {
    const result: AiEditorActionResult = {
      ok: false,
      action,
      summary:
        error instanceof Error
          ? error.message
          : "Failed to apply AI editor action",
      error: error instanceof Error ? error.message : "Failed to apply AI editor action",
    };
    await appendAiJobRecord(envelope, result);
    return result;
  }
}
