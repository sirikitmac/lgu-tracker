/** Mock community data. Everything here is fictional sample content, not real people. */

export interface Profile {
  id: string;
  name: string;
  /** Where they say they are from, e.g. "Iligan City". */
  place: string;
  /** A short label shown beside the name. */
  tag: string;
  /** Avatar background (0-5) and silhouette (0-2); see Avatar. */
  tone: number;
  shape: number;
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
  /** Needed for posts made in this browser, whose author is not a sample profile. */
  authorName?: string;
  title: string;
  body: string;
  createdAt: string;
  /** Votes the post had before you. Your own vote adds or removes one. */
  score: number;
  project?: ProjectLink;
}

export interface Comment {
  id: string;
  postId: string;
  /** null for a comment on the post itself, otherwise the comment being replied to. */
  parentId: string | null;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  score: number;
}

export type Vote = 1 | -1;
export type Sort = 'latest' | 'top';

export const POST_LIMITS = { titleMin: 8, titleMax: 140, bodyMin: 10, bodyMax: 2000, commentMax: 1000 } as const;
