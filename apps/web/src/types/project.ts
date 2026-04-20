import { AiJobRecord } from "@/types/ai-editor";

export interface TProject {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
  mediaItems?: string[];
  backgroundColor?: string;
  backgroundType?: "color" | "blur";
  blurIntensity?: number; // in pixels (4, 8, 18)
  canvasWidth?: number;
  canvasHeight?: number;
  fps?: number;
  bookmarks?: number[];
  description?: string;
  sourcePrompt?: string;
  aiJobs?: AiJobRecord[];
}
