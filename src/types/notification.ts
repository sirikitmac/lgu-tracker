/** Mirrors the public.notification_kind enum in supabase/migrations. */
export type NotificationKind =
  | 'report_received'
  | 'report_new'
  | 'report_update'
  | 'role_requested'
  | 'role_decided'
  | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** An in-app path such as /my-reports/<id>, or null. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function isNotificationKind(value: unknown): value is NotificationKind {
  return (
    value === 'report_received' ||
    value === 'report_new' ||
    value === 'report_update' ||
    value === 'role_requested' ||
    value === 'role_decided' ||
    value === 'system'
  );
}
