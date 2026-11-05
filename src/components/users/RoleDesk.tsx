'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/StateViews';
import { useToast } from '@/components/ui/Toast';
import { decideRole } from '@/lib/actions/users';
import { ROLE_BLURB, ROLE_LABEL, assignableRoles, canChangeRoleOf } from '@/lib/auth/roles';
import { stampLabel } from '@/lib/notifications/time';
import type { AccountType, AppRole } from '@/types/auth';

export interface Person {
  id: string;
  name: string;
  role: AppRole;
  requestedRole: AppRole | null;
  accountType: AccountType;
  organization: string | null;
  position: string | null;
  createdAt: string;
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
const select = `h-10 w-full min-w-0 cursor-pointer rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-accent-ink focus:bg-surface ${focusRing}`;
const ACCOUNT_LABEL: Record<AccountType, string> = {
  citizen: 'Citizen',
  organization_employee: 'Organization employee',
  technical_developer: 'Technical / developer',
};

function useDecide() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (userId: string, decision: 'approve' | 'decline', role: string | undefined, done: string) => {
    setError(null);
    startTransition(async () => {
      const res = await decideRole(userId, decision, role);
      if (!res.ok) return setError(res.error);
      toast({ tone: 'success', title: done, description: 'They were told in their inbox.' });
      router.refresh();
    });
  };
  return { busy, error, run };
}

function RequestCard({ person, actor }: { person: Person; actor: AppRole }) {
  const options = assignableRoles(actor);
  const wanted = person.requestedRole;
  const canGrantWanted = wanted !== null && options.includes(wanted);
  const [choice, setChoice] = useState<AppRole>(canGrantWanted ? wanted : (options[0] ?? 'planning_officer'));
  const { busy, error, run } = useDecide();
  const needsSuper = wanted !== null && !canGrantWanted;

  return (
    <li className="rounded-3xl border border-line bg-surface p-5 shadow-raise">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight text-ink">{person.name || 'New account'}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {ACCOUNT_LABEL[person.accountType]}
            {person.organization ? ` · ${person.organization}` : ''} · joined {stampLabel(person.createdAt)}
          </p>
        </div>
        <p className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-ink">
          {wanted ? `Asked to be ${ROLE_LABEL[wanted]}` : person.accountType === 'technical_developer' ? 'Technical account, no role yet' : 'Organization account, no role yet'}
        </p>
      </div>
      {wanted && <p className="mt-2 text-[13px] leading-relaxed text-subtle">{ROLE_BLURB[wanted]}</p>}
      <p className="mt-1 text-xs text-muted">
        What they typed at sign-up is a request, not a fact. Check the name and office before you approve.
      </p>

      {needsSuper ? (
        <p className="mt-4 rounded-2xl bg-sunken px-4 py-3 text-[13.5px] text-subtle">
          Administrator roles are decided by a Super Administrator. Super Administrators were notified.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[13rem] flex-1 sm:max-w-xs">
            <label htmlFor={`role-${person.id}`} className="mb-1.5 block text-[13px] font-semibold text-ink">Give the role</label>
            <select id={`role-${person.id}`} value={choice} onChange={(e) => setChoice(e.target.value as AppRole)} className={select}>
              {options.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}{r === wanted ? ' (requested)' : ''}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(person.id, 'approve', choice, `${person.name || 'Account'} is now ${ROLE_LABEL[choice]}`)}
            className={`inline-flex h-10 cursor-pointer items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            Approve
          </button>
        </div>
      )}
      {!needsSuper && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(person.id, 'decline', undefined, 'Request declined')}
          className={`mt-3 inline-flex h-9 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} `}
        >
          Decline
        </button>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-ink">{error}</p>}
    </li>
  );
}

function MemberRow({ person, actor }: { person: Person; actor: AppRole }) {
  const options = assignableRoles(actor);
  const editable = canChangeRoleOf(actor, person.role);
  const [choice, setChoice] = useState<AppRole>(person.role);
  const { busy, error, run } = useDecide();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-[15px] font-semibold text-ink">{person.name || 'Unnamed account'}</p>
        <p className="truncate text-[13px] text-muted">{[person.position, person.organization].filter(Boolean).join(' · ') || ACCOUNT_LABEL[person.accountType]}</p>
      </div>
      {editable ? (
        <>
          <label htmlFor={`m-${person.id}`} className="sr-only">Role for {person.name || 'this account'}</label>
          <select id={`m-${person.id}`} value={choice} onChange={(e) => setChoice(e.target.value as AppRole)} className={`${select} sm:w-52`}>
            {options.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button
            type="button"
            disabled={busy || choice === person.role}
            onClick={() => run(person.id, 'approve', choice, `Role changed to ${ROLE_LABEL[choice]}`)}
            className={`inline-flex h-10 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
          >
            Save
          </button>
        </>
      ) : (
        <p className="text-sm font-medium text-subtle">{ROLE_LABEL[person.role]}<span className="ml-2 text-xs font-normal text-muted">Super Administrator only</span></p>
      )}
      {error && <p role="alert" className="w-full rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2 text-[13px] text-danger-ink">{error}</p>}
    </li>
  );
}

export function RoleDesk({ pending, members, actor, actorId }: { pending: Person[]; members: Person[]; actor: AppRole; actorId: string }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-3 text-lg font-bold tracking-tight text-ink">
          Waiting for a decision{pending.length > 0 && <span className="ml-2 text-base font-medium text-muted">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line-strong bg-surface">
            <EmptyState icon={ShieldCheck} title="No role requests" description="When someone signs up asking for a role, they show up here and in your inbox." />
          </div>
        ) : (
          <ul className="space-y-3">{pending.map((p) => <RequestCard key={p.id} person={p} actor={actor} />)}</ul>
        )}
      </section>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-3 text-lg font-bold tracking-tight text-ink">People with a role</h2>
        {members.length === 0 ? (
          <p className="text-sm text-subtle">No one has a role yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {members.filter((m) => m.id !== actorId).map((m) => <MemberRow key={m.id} person={m} actor={actor} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
