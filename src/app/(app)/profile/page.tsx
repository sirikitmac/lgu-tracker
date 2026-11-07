import type { Metadata } from 'next';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NotAvailable } from '@/components/workspace/PageStates';
import { ROLE_LABEL } from '@/lib/auth/roles';
import { pageAccess } from '@/lib/auth/page';

export const metadata: Metadata = { title: 'Your profile | LGU Tracker', robots: { index: false } };

export default async function ProfilePage() {
  const access = await pageAccess('/profile');
  if (access.state !== 'ok') return <NotAvailable />;
  const { profile } = access;

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Choose how you appear: your name, your job and a picture. A photo of you or a free avatar, whichever you like."
      />
      <ProfileEditor
        userId={profile.id}
        email={profile.email}
        roleLabel={ROLE_LABEL[profile.role]}
        initial={{
          fullName: profile.fullName,
          positionTitle: profile.positionTitle ?? '',
          avatarPath: profile.avatarPath,
          avatarPreset: profile.avatarPreset,
        }}
      />
    </>
  );
}
