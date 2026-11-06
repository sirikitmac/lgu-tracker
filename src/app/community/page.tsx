import type { Metadata } from 'next';
import { CommunityHome } from '@/components/community/CommunityHome';

export const metadata: Metadata = {
  title: 'Bantay Community | LGU Tracker',
  description: 'Usapang bayan tungkol sa mga proyekto at alalahanin ng komunidad. Read discussions without an account.',
};

export default function CommunityPage() {
  return <CommunityHome />;
}
