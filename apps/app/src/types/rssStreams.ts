export type RssStream = {
  id: string;
  title: string;
  slug: string;
  rssUrl: string;
  maxParticipants: number;
  minParticipants: number;
  durationMinutes: number;
  timeOfDay: string;
  autoPublish: boolean;
  contentPaths?: string[] | null;
  collaboratorCount?: number;
  lastItemPublishedAt?: string | null;
  createdAt?: string;
  sessionsCount?: number;
};

export type RssStreamAdminListItem = RssStream & {
  _count?: { collaborators: number; sessions: number };
};

export type StreamValidationPreview = {
  sessionTitle: string;
  itemTitle: string;
  itemGuid: string;
  itemPublishedAt: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timeOfDay: string;
  sourceTitle: string;
  sourceBody: string;
  wordCount: number;
  autoPublish: boolean;
};

export type StreamValidationTree = {
  path: string;
  key: string;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  preview?: string;
  children?: StreamValidationTree[];
};
