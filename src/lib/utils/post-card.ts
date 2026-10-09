/** Conversion d'un document « posts » en données sérialisables (serveur et navigateur). */

/** Post affiché sur l'accueil (sérialisable). */
export interface PostCardData {
  id: string;
  title: string;
  content: string;
  /** Date ISO */
  createdAt: string;
  visible: boolean;
  userName: string;
  userId?: string;
  likes: string[];
}

export function toPostCard(id: string, data: Record<string, unknown>): PostCardData {
  const created = data.createdAt as { toDate?: () => Date } | Date | string | undefined;
  const createdAt =
    created && typeof (created as { toDate?: () => Date }).toDate === 'function'
      ? (created as { toDate: () => Date }).toDate().toISOString()
      : created instanceof Date
        ? created.toISOString()
        : typeof created === 'string'
          ? created
          : new Date(0).toISOString();
  return {
    id,
    title: (data.title as string) || '',
    content: (data.content as string) || '',
    createdAt,
    visible: data.visible !== false,
    userName: (data.userName as string) || 'Anonyme',
    userId: (data.userId as string) || undefined,
    likes: Array.isArray(data.likes) ? (data.likes as string[]) : [],
  };
}
