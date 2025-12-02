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
  collaboratorCount?: number;
  lastItemPublishedAt?: string | null;
  createdAt?: string;
  sessionsCount?: number;
};

export type RssStreamAdminListItem = RssStream & {
  _count?: { collaborators: number; sessions: number };
};
