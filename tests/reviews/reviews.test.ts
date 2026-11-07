import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REVIEW_MAX,
  applyChange,
  averageRating,
  charCount,
  mergeReviews,
  newestFirst,
  reviewFromRow,
  shownName,
  starsLabel,
  validateReview,
  type Review,
  type SampleReview,
} from '@/lib/reviews/logic';
import { TESTIMONIALS } from '@/lib/community/mock';

let n = 0;
const review = (over: Partial<Review> = {}): Review => {
  n += 1;
  return {
    id: `r${n}`,
    userId: `u${n}`,
    rating: 4,
    body: 'Malaking tulong sa amin.',
    displayName: 'Ana Reyes',
    jobTitle: null,
    avatarPath: null,
    avatarPreset: null,
    status: 'published',
    createdAt: `2026-11-0${Math.min(n, 9)}T10:00:00Z`,
    updatedAt: `2026-11-0${Math.min(n, 9)}T10:00:00Z`,
    ...over,
  };
};
const samples: SampleReview[] = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `s${i}`, rating: 4, body: 'Sample', lang: 'en' }));

test('validateReview trims and accepts a good review', () => {
  const res = validateReview({ rating: 4, body: '   Maganda ang app na ito!  ', firstNameOnly: true });
  assert.deepEqual(res, { ok: true, value: { rating: 4, body: 'Maganda ang app na ito!', firstNameOnly: true } });
  assert.equal(validateReview({ rating: '5', body: 'Ten chars!' }).ok, true, 'a form string rating is fine');
});

test('validateReview: rating must be a whole number from 1 to 5', () => {
  for (const rating of [0, 6, 3.5, NaN, null, undefined, '', 'five', -1]) {
    const res = validateReview({ rating, body: 'A perfectly fine review.' });
    assert.equal(res.ok, false, String(rating));
    if (!res.ok) {
      assert.equal(res.field, 'rating');
      assert.match(res.error, /1 to 5 stars/);
    }
  }
});

test('validateReview: 10 to 500 characters after trimming, with friendly messages', () => {
  const empty = validateReview({ rating: 3, body: '     ' });
  assert.ok(!empty.ok && empty.field === 'body' && /few words/.test(empty.error));
  const short = validateReview({ rating: 3, body: '  Okay po  ' });
  assert.ok(!short.ok && /at least 10 characters \(3 more\)/.test(short.error));
  const long = validateReview({ rating: 3, body: 'a'.repeat(REVIEW_MAX + 2) });
  assert.ok(!long.ok && /Remove 2/.test(long.error));
  assert.equal(validateReview({ rating: 3, body: 'a'.repeat(REVIEW_MAX) }).ok, true);
  assert.equal(validateReview(null).ok, false);
});

test('emoji and non-Latin text are counted as people count them', () => {
  assert.equal(charCount('👍🏽'), 2, 'thumbs up and skin tone');
  assert.equal(charCount('mabuhay😀'), 8);
  const emoji = validateReview({ rating: 5, body: '😀'.repeat(REVIEW_MAX) });
  assert.equal(emoji.ok, true, '500 emoji fit even though they are 1000 UTF-16 units');
  assert.equal(validateReview({ rating: 5, body: 'ありがとうございます、とても便利' }).ok, true);
});

test('control characters are removed, line breaks kept', () => {
  const res = validateReview({ rating: 4, body: 'Line one\u0000\r\n\n\n\nLine two\u0007 ok' });
  assert.ok(res.ok);
  assert.equal(res.ok && res.value.body, 'Line one\n\nLine two  ok');
});

test('shownName: full name or first name only', () => {
  assert.equal(shownName('  Maria   Clara Santos ', false), 'Maria Clara Santos');
  assert.equal(shownName('Maria Clara Santos', true), 'Maria');
  assert.equal(shownName('', true), 'Community');
  assert.equal(shownName('', false), 'Community member');
});

test('averageRating uses published real reviews only, one decimal', () => {
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([review({ rating: 5 }), review({ rating: 4 }), review({ rating: 4 })]), 4.3);
  assert.equal(averageRating([review({ rating: 5 }), review({ rating: 1, status: 'hidden' })]), 5);
  assert.equal(averageRating([review({ rating: 2, status: 'hidden' })]), null);
});

test('newestFirst orders by creation time, then id', () => {
  const a = review({ id: 'a', createdAt: '2026-11-01T00:00:00Z' });
  const b = review({ id: 'b', createdAt: '2026-11-03T00:00:00Z' });
  const c = review({ id: 'c', createdAt: '2026-11-03T00:00:00Z' });
  assert.deepEqual(newestFirst([a, c, b]).map((r) => r.id), ['b', 'c', 'a']);
});

test('mergeReviews: real ones first, samples fill up to 6, never mixed into the count', () => {
  const none = mergeReviews([], samples);
  assert.equal(none.length, 6);
  assert.ok(none.every((c) => c.kind === 'sample'));

  const old = review({ createdAt: '2026-10-01T00:00:00Z' });
  const fresh = review({ createdAt: '2026-11-05T00:00:00Z' });
  const hidden = review({ status: 'hidden', createdAt: '2026-11-06T00:00:00Z' });
  const two = mergeReviews([old, fresh, hidden], samples);
  assert.deepEqual(two.map((c) => c.kind), ['real', 'real', 'sample', 'sample', 'sample', 'sample']);
  assert.equal(two[0].kind === 'real' && two[0].review.id, fresh.id);

  const many = Array.from({ length: 8 }, () => review());
  const full = mergeReviews(many, samples);
  assert.equal(full.length, 6);
  assert.ok(full.every((c) => c.kind === 'real'));
  assert.equal(new Set(full.map((c) => c.key)).size, 6, 'keys are unique');
});

test('applyChange adds, replaces, hides and removes', () => {
  const a = review({ createdAt: '2026-11-01T00:00:00Z' });
  let list = applyChange([], { type: 'upsert', review: a });
  assert.deepEqual(list.map((r) => r.id), [a.id]);

  const b = review({ createdAt: '2026-11-04T00:00:00Z' });
  list = applyChange(list, { type: 'upsert', review: b });
  assert.deepEqual(list.map((r) => r.id), [b.id, a.id], 'a new review goes first');

  list = applyChange(list, { type: 'upsert', review: { ...a, rating: 2 } });
  assert.equal(list.find((r) => r.id === a.id)?.rating, 2, 'an edit replaces in place');
  assert.equal(list.length, 2);

  list = applyChange(list, { type: 'upsert', review: { ...b, status: 'hidden' } });
  assert.deepEqual(list.map((r) => r.id), [a.id], 'a hidden review leaves the list');

  list = applyChange(list, { type: 'remove', id: a.id });
  assert.deepEqual(list, []);
});

test('reviewFromRow maps a database row and rejects junk', () => {
  const r = reviewFromRow({
    id: 'x', user_id: 'u', rating: 3, body: '<b>not html</b>', display_name: ' Ana ', job_title: '', avatar_path: null,
    avatar_preset: 'p2', status: 'published', created_at: '2026-11-07T00:00:00Z', updated_at: '2026-11-07T00:00:00Z',
  });
  assert.equal(r?.displayName, 'Ana');
  assert.equal(r?.jobTitle, null);
  assert.equal(r?.body, '<b>not html</b>', 'kept as plain text; React escapes it');
  assert.equal(reviewFromRow({ id: 'x', user_id: 'u', rating: 9, body: 'x', created_at: 'now' }), null);
  assert.equal(reviewFromRow(null), null);
});

test('starsLabel reads well', () => {
  assert.equal(starsLabel(4), '4 out of 5 stars');
});

test('the sample reviews have a believable mix of stars', () => {
  const ratings = TESTIMONIALS.map((t) => t.rating);
  assert.ok(ratings.every((r) => Number.isInteger(r) && r >= 1 && r <= 5));
  assert.ok(new Set(ratings).size >= 3, 'not all the same');
  assert.ok(ratings.includes(3), 'at least one 3-star');
  assert.ok(ratings.filter((r) => r === 5).length < ratings.length / 2, 'not mostly fives');
});
