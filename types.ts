
export enum View {
  GENERATE = 'GENERATE',
  EDIT = 'EDIT',
  CHAT = 'CHAT',
  GALLERY = 'GALLERY'
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
export type ImageSize = "1K" | "2K" | "4K";

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: AspectRatio;
  size: ImageSize;
  timestamp: number;
  tags?: string[];
  sourceType: 'generated' | 'edited' | 'upscaled';
}

export interface PromptCategory {
  label: string;
  options: string[];
}

export type SortOrder = 'newest' | 'oldest';
