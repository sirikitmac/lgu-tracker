import React from 'react';
import { Quote } from 'lucide-react';
import { Avatar } from '@/components/community/Avatar';
import { TESTIMONIALS } from '@/lib/community/mock';
import { profileById } from '@/lib/community/profiles';

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

/**
 * What people say about Bantay Proyekto, near the foot of the landing page.
 * Sample reviews by the same made-up people who appear in the community.
 */
export function Testimonials({ frameClass }: { frameClass: string }) {
  return (
    <section id="reviews" className="bg-ground py-20 lg:py-32 scroll-mt-16" aria-labelledby="reviews-title">
      <div className={frameClass}>
        <div className="max-w-2xl">
          <h2 id="reviews-title" data-reveal className="display text-[length:var(--step-head)] text-ink">
            Ano ang sabi nila<span className="text-accent-ink">?</span>
          </h2>
          <p data-reveal style={delay(70)} className="mt-5 text-[17px] leading-snug text-ink max-w-[46ch]">
            What residents, students, reporters and LGU staff say about Bantay Proyekto.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => {
            const person = profileById(t.profileId);
            if (!person) return null;
            // The first and the last card are filled with the brand colour; the rest are quiet surfaces.
            const featured = i === 0;
            return (
              <li
                key={t.profileId}
                data-reveal
                style={delay((i % 3) * 70)}
                className={`rounded-[24px] p-6 ${
                  featured ? 'bg-night text-white dark:ring-1 dark:ring-white/12' : 'bg-surface border border-line text-ink'
                }`}
              >
                <figure className="flex h-full flex-col">
                <Quote className={`h-6 w-6 ${featured ? 'text-signal' : 'text-accent-ink'}`} aria-hidden="true" />
                <blockquote lang={t.lang === 'tl' ? 'fil' : 'en'} className="mt-4 flex-1 text-[16px] leading-relaxed">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar profile={person} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{person.name}</span>
                    <span className={`block truncate text-[13px] ${featured ? 'text-white/75' : 'text-subtle'}`}>
                      {person.tag} · {person.place}
                    </span>
                  </span>
                </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>

        <p data-reveal className="mt-6 text-[13px] text-subtle">
          Sample reviews by fictional people, shown for preview.
        </p>
      </div>
    </section>
  );
}
