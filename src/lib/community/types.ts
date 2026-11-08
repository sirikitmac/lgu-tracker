/** Mock community data. Everything here is fictional sample content, not real people. */

export interface Profile {
  id: string;
  name: string;
  /** Where they say they are from, e.g. "Iligan City". */
  place: string;
  /** A short label shown beside the name. */
  tag: string;
  /** Avatar background (0-5) and silhouette (0-2); kept for older callers, see Avatar. */
  tone: number;
  shape: number;
  /** The drawn face; see Avatar. Made up from the id when a profile has none. */
  look?: Look;
}

export type HairStyle = 'short' | 'side' | 'crop' | 'curly' | 'long' | 'wave' | 'bob' | 'bun';

/** How a sample person is drawn. Indexes point into the palettes in Avatar. */
export interface Look {
  /** Skin tone, 0 (lightest) to 4. */
  skin: number;
  hair: HairStyle;
  /** 0 black, 1 dark brown, 2 brown, 3 grey. */
  hairColor: number;
  /** Clothing colour, 0-5. */
  top: number;
  glasses?: boolean;
  facial?: 'stubble' | 'mustache';
}

/** A project a discussion is about. `href` is where it opens in the directory. */
export interface ProjectLink {
  title: string;
  href: string;
  /** The project code, when known. */
  code?: string;
}

export interface Post {
  id: string;
  authorId: string;
  /** How the author appeared when they wrote it (kept current by the database). */
  authorName?: string;
  authorTitle?: string | null;
  authorAvatarPath?: string | null;
  authorAvatarPreset?: string | null;
  /** True for the made-up preview discussions; their `authorId` is a sample profile key. */
  sample?: boolean;
  title: string;
  body: string;
  createdAt: string;
  /** Everyone's votes added up, yours included. */
  score: number;
  /** Comments and replies on it. */
  commentCount?: number;
  project?: ProjectLink;
}

export interface Comment {
  id: string;
  postId: string;
  /** null for a comment on the post itself, otherwise the comment being replied to. */
  parentId: string | null;
  authorId: string;
  authorName?: string;
  authorTitle?: string | null;
  authorAvatarPath?: string | null;
  authorAvatarPreset?: string | null;
  sample?: boolean;
  body: string;
  createdAt: string;
  score: number;
}

export type Vote = 1 | -1;
export type Sort = 'latest' | 'top';

export const POST_LIMITS = { titleMin: 8, titleMax: 140, bodyMin: 10, bodyMax: 2000, commentMax: 1000 } as const;
