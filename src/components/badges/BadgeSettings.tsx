'use client';

import React, { useId, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Pill, announceBadgeStylesChanged } from '@/components/badges/RoleBadge';
import { controlClass, primaryButtonClass, secondaryButtonSmClass } from '@/components/dpwh/ui';
import { useToast } from '@/components/ui/Toast';
import { saveBadgeStyle, saveMyBadge } from '@/lib/actions/badges';
import {
  BADGE_LABEL_MAX,
  BADGE_SWATCHES,
  BADGE_TIERS,
  BADGE_TIER_NAME,
  isHexColor,
  validateBadge,
  type BadgeStyle,
  type BadgeStyles,
  type BadgeTier,
} from '@/lib/badges/badges';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** A name and a colour, with a live preview. Used for the default pills and for your own. */
function StyleEditor({
  heading,
  hint,
  initial,
  fallback,
  saveLabel,
  onSave,
  onRemove,
}: {
  heading: string;
  hint?: string;
  initial: BadgeStyle | null;
  /** What to preview while nothing is set. */
  fallback: BadgeStyle;
  saveLabel: string;
  onSave: (value: BadgeStyle) => Promise<string | null>;
  onRemove?: () => Promise<string | null>;
}) {
  const id = useId();
  const start = initial ?? fallback;
  const [label, setLabel] = useState(initial?.label ?? '');
  const [color, setColor] = useState(start.color);
  const [saved, setSaved] = useState<BadgeStyle | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview: BadgeStyle = { label: label.trim() || fallback.label, color: isHexColor(color) ? color : start.color };
  const dirty = saved ? label.trim() !== saved.label || color.toUpperCase() !== saved.color : label.trim() !== '';

  const run = (job: () => Promise<string | null>, after: () => void) =>
    startTransition(async () => {
      setError(null);
      const problem = await job();
      if (problem) setError(problem);
      else after();
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateBadge(label, color);
    if (!check.ok) return setError(check.problem.message);
    run(() => onSave({ label: check.label, color: check.color }), () => {
      setSaved({ label: check.label, color: check.color });
      setLabel(check.label);
      setColor(check.color);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-h`} className="text-sm font-semibold text-ink">
          {heading}
        </h3>
        <Pill style={preview} />
      </div>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label htmlFor={`${id}-label`} className="block text-xs font-semibold text-muted">
            Name on the pill
          </label>
          <input
            id={`${id}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={BADGE_LABEL_MAX + 10}
            placeholder={fallback.label}
            className={`${controlClass} mt-1`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-hex`} className="block text-xs font-semibold text-muted">
            Colour
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={isHexColor(color) ? color : '#000000'}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              aria-label="Pick a colour"
              className={`h-10 w-12 shrink-0 cursor-pointer rounded-control border border-line-strong bg-surface p-1 ${focusRing}`}
            />
            <input
              id={`${id}-hex`}
              value={color}
              onChange={(e) => setColor(e.target.value.trim().toUpperCase())}
              maxLength={7}
              spellCheck={false}
              aria-label="Colour code"
              className={`${controlClass} w-28 font-mono`}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colour ideas">
        {BADGE_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            aria-pressed={color.toUpperCase() === c}
            className={`grid h-7 w-7 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${focusRing} ${color.toUpperCase() === c ? 'ring-ink' : 'ring-transparent hover:ring-line-strong'}`}
            style={{ backgroundColor: c }}
          >
            {color.toUpperCase() === c && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" aria-hidden="true" />}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !dirty} className={`${primaryButtonClass} disabled:opacity-50`}>
          {pending ? 'Saving…' : saveLabel}
        </button>
        {onRemove && saved && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(onRemove, () => {
                setSaved(null);
                setLabel('');
                setColor(fallback.color);
              })
            }
            className={secondaryButtonSmClass}
          >
            Remove my pill
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * For administrators: your own pill, and the colours of the three default
 * pills. Everything here is checked again by the database, which only lets an
 * administrator change them.
 */
export function BadgeSettings({
  tier,
  styles,
  mine,
}: {
  /** Your own default pill; decides what your custom one is previewed against. */
  tier: BadgeTier;
  styles: BadgeStyles;
  mine: BadgeStyle | null;
}) {
  const { toast } = useToast();
  const id = useId();

  return (
    <section className="space-y-6 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby={`${id}-h`}>
      <div>
        <h2 id={`${id}-h`} className="text-base font-bold tracking-tight text-ink">
          Role pills
        </h2>
        <p className="mt-1 text-sm text-subtle">
          The coloured tag beside a name in the community and on profiles. Only administrators can change these. Citizens have no pill.
        </p>
      </div>

      <StyleEditor
        heading="Your own pill"
        hint="Shown beside your name instead of your role's pill. Leave it empty to use the default."
        initial={mine}
        fallback={styles[tier]}
        saveLabel="Save my pill"
        onSave={async (value) => {
          const res = await saveMyBadge(value);
          if (!res.ok) return res.error;
          toast({ tone: 'success', title: 'Your pill is saved' });
          return null;
        }}
        onRemove={async () => {
          const res = await saveMyBadge(null);
          if (!res.ok) return res.error;
          toast({ tone: 'success', title: 'Your pill is removed' });
          return null;
        }}
      />

      <div className="space-y-6 border-t border-line pt-5">
        <p className="text-sm text-subtle">Default pills: a change shows for everyone with that role, straight away.</p>
        {BADGE_TIERS.map((t) => (
          <StyleEditor
            key={t}
            heading={BADGE_TIER_NAME[t]}
            initial={styles[t]}
            fallback={styles[t]}
            saveLabel="Save"
            onSave={async (value) => {
              const res = await saveBadgeStyle({ tier: t, ...value });
              if (!res.ok) return res.error;
              announceBadgeStylesChanged();
              toast({ tone: 'success', title: `${BADGE_TIER_NAME[t]} pill saved` });
              return null;
            }}
          />
        ))}
      </div>
    </section>
  );
}
