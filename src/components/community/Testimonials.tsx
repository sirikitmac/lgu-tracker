import React from 'react';
import { ReviewsBoard, type SampleCard } from '@/components/reviews/ReviewsBoard';
import { TESTIMONIALS } from '@/lib/community/mock';
import { profileById } from '@/lib/community/profiles';

const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as React.CSSProperties;

/** The sample reviews, by the same made-up people who appear in the community. */
const SAMPLES: SampleCard[] = TESTIMONIALS.flatMap((t) => {
  const person = profileById(t.profileId);
  return person ? [{ id: t.profileId, rating: t.rating, body: t.quote, lang: t.lang, person }] : [];
});

/**
 * What people say about Bantay Proyekto, near the foot of the landing page.
 * Real reviews by signed-in people come first and update live; sample reviews
 * fill the rest of the grid (see ReviewsBoard).
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

        <ReviewsBoard samples={SAMPLES} />
      </div>
    </section>
  );
}
