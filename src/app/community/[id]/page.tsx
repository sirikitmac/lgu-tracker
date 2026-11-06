import type { Metadata } from 'next';
import { PostThread } from '@/components/community/PostThread';

export const metadata: Metadata = { title: 'Discussion | Bantay Community' };

export default async function CommunityThreadPage({ params }: PageProps<'/community/[id]'>) {
  const { id } = await params;
  return <PostThread postId={id} />;
}
