import type { Metadata } from 'next';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NotAvailable } from '@/components/workspace/PageStates';
import { BadgeSettings } from '@/components/badges/BadgeSettings';
import { ROLE_LABEL, isAdminRole } from '@/lib/auth/roles';
import { badgeTierOf, isHexColor } from '@/lib/badges/badges';
import { getBadgeStyles } from '@/lib/badges/server';
import { pageAccess } from '@/lib/auth/page';

export const metadata: Metadata = { title: 'Your profile | LGU Tracker', robots: { index: false } };

export default async function ProfilePage() {
  const access = await pageAccess('/profile');
  if (access.state !== 'ok') return <NotAvailable />;
  const { profile } = access;
  const styles = await getBadgeStyles();
  const tier = badgeTierOf(profile.role);
  const mine = profile.badgeLabel && isHexColor(profile.badgeColor) && isAdminRole(profile.role) ? { label: profile.badgeLabel, color: profile.badgeColor } : null;

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
        badge={{ tier, customLabel: mine?.label ?? null, customColor: mine?.color ?? null, styles }}
        initial={{
          fullName: profile.fullName,
          positionTitle: profile.positionTitle ?? '',
          avatarPath: profile.avatarPath,
          avatarPreset: profile.avatarPreset,
        }}
      />
      {isAdminRole(profile.role) && tier && (
        <div className="mt-6 max-w-2xl">
          <BadgeSettings tier={tier} styles={styles} mine={mine} />
        </div>
      )}
    </>
  );
}
