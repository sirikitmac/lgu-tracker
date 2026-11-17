import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMMENT_COLUMNS,
  POST_COLUMNS,
  anonymousAuthorFromRow,
  commentFromRow,
  isOwnItem,
  postFromRow,
  upsertById,
  withKnownAuthors,
} from '@/lib/community/rows';

const ME = '11111111-1111-1111-1111-111111111111';
const ADMIN_SEES = '22222222-2222-2222-2222-222222222222';

const anonRow = {
  id: 'p1',
  author_id: null,
  sample_author: null,
  title: 'Tanong ko lang, walang pangalan',
  body: 'Ayaw kong makilala.',
  author_name: 'Anonymous',
  author_title: null,
  author_avatar_path: null,
  author_avatar_preset: null,
  score: 0,
  comment_count: 0,
  is_sample: false,
  is_anonymous: true,
  created_at: '2026-11-17T00:00:00Z',
};

test('anonymous rows are read, with no author and nothing to show about them', () => {
  const p = postFromRow(anonRow);
  assert.ok(p);
  assert.equal(p.anonymous, true);
  assert.equal(p.authorId, '');
  assert.equal(p.authorName, 'Anonymous');
  assert.equal(p.authorTitle, null);
  assert.equal(p.authorAvatarPath, null);
  // Even if a row somehow carried a name or picture, an anonymous item shows none of it.
  const leaky = postFromRow({ ...anonRow, author_name: 'Maria', author_avatar_preset: 'p4', author_title: 'Teacher' });
  assert.equal(leaky?.authorName, 'Anonymous');
  assert.equal(leaky?.authorAvatarPreset, null);
  assert.equal(leaky?.authorTitle, null);
  const c = commentFromRow({ ...anonRow, id: 'c1', post_id: 'p1', parent_id: null });
  assert.equal(c?.anonymous, true);
});

test('a named row without an author is still rejected', () => {
  assert.equal(postFromRow({ ...anonRow, is_anonymous: false }), null);
});

test('the columns read include is_anonymous', () => {
  assert.match(POST_COLUMNS, /is_anonymous/);
  assert.match(COMMENT_COLUMNS, /is_anonymous/);
});

test('private author records mark only anonymous items, and ownership follows them', () => {
  const posts = [postFromRow(anonRow)!, postFromRow({ ...anonRow, id: 'p2' })!, postFromRow({ ...anonRow, id: 'p3', is_anonymous: false, author_id: ME, author_name: 'Maria' })!];
  const records = [
    anonymousAuthorFromRow({ post_id: 'p1', comment_id: null, author_id: ME, author_name: 'Maria' })!,
    anonymousAuthorFromRow({ post_id: 'p3', comment_id: null, author_id: ADMIN_SEES, author_name: 'X' })!,
  ];
  const marked = withKnownAuthors(posts, records, 'post');
  assert.equal(marked[0].knownAuthorId, ME);
  assert.equal(marked[1].knownAuthorId, undefined, 'no record, nothing known');
  assert.equal(marked[2].knownAuthorId, undefined, 'a named post is never re-labelled');

  assert.equal(isOwnItem(marked[0], ME), true);
  assert.equal(isOwnItem(marked[0], ADMIN_SEES), false);
  assert.equal(isOwnItem(marked[1], ME), false);
  assert.equal(isOwnItem(marked[2], ME), true);
  assert.equal(isOwnItem(marked[0], null), false);
  assert.equal(isOwnItem({ authorId: ME, sample: true }, ME), false);
});

test('a live update keeps what the viewer already knew about an anonymous item', () => {
  const known = { ...postFromRow(anonRow)!, knownAuthorId: ME, knownAuthorName: 'Maria' };
  const update = { ...postFromRow(anonRow)!, score: 5 };
  const [after] = upsertById([known], update);
  assert.equal(after.score, 5);
  assert.equal(after.knownAuthorId, ME);
});

test('bad private records are ignored', () => {
  assert.equal(anonymousAuthorFromRow({ post_id: null, comment_id: null, author_id: ME }), null);
  assert.equal(anonymousAuthorFromRow({ post_id: 'p1', author_id: null }), null);
  assert.equal(anonymousAuthorFromRow(null), null);
});
