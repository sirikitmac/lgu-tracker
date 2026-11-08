import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildThread, scoreAfterVote, sortItems, toggleVote, validateComment, validatePost } from '@/lib/community/logic';
import { MOCK_COMMENTS, MOCK_POSTS, TESTIMONIALS } from '@/lib/community/mock';
import { PROFILES, lookFromSeed, profileById, resolveAuthor } from '@/lib/community/profiles';

test('voting toggles and switches', () => {
  assert.equal(toggleVote(undefined, 1), 1);
  assert.equal(toggleVote(1, 1), undefined);
  assert.equal(toggleVote(1, -1), -1);
  assert.equal(scoreAfterVote(10, undefined, 1), 11);
  assert.equal(scoreAfterVote(10, 1, undefined), 9);
  assert.equal(scoreAfterVote(10, 1, -1), 8);
  assert.equal(scoreAfterVote(10, -1, 1), 12);
});

test('latest sorts by time, top by score', () => {
  const items = [
    { id: 'a', createdAt: '2026-11-01T00:00:00Z', score: 5 },
    { id: 'b', createdAt: '2026-11-03T00:00:00Z', score: 1 },
    { id: 'c', createdAt: '2026-11-02T00:00:00Z', score: 4 },
  ];
  assert.deepEqual(sortItems(items, 'latest').map((x) => x.id), ['b', 'c', 'a']);
  assert.deepEqual(sortItems(items, 'top').map((x) => x.id), ['a', 'c', 'b']);
});

test('comments nest, replies read oldest first, orphans surface', () => {
  const base = { postId: 'p', authorId: 'x', body: 'b', score: 0 };
  const tree = buildThread(
    [
      { ...base, id: '1', parentId: null, createdAt: '2026-11-01T00:00:00Z' },
      { ...base, id: '2', parentId: '1', createdAt: '2026-11-01T02:00:00Z' },
      { ...base, id: '3', parentId: '1', createdAt: '2026-11-01T01:00:00Z' },
      { ...base, id: '4', parentId: 'gone', createdAt: '2026-11-02T00:00:00Z' },
    ],
    'latest',
  );
  assert.deepEqual(tree.map((n) => n.comment.id), ['4', '1']);
  assert.deepEqual(tree[1].replies.map((n) => n.comment.id), ['3', '2']);
  assert.equal(tree[1].replies[0].depth, 1);
});

test('indent stops growing at the maximum', () => {
  const base = { postId: 'p', authorId: 'x', body: 'b', score: 0 };
  const chain = Array.from({ length: 8 }, (_, i) => ({ ...base, id: String(i), parentId: i ? String(i - 1) : null, createdAt: `2026-11-01T0${i}:00:00Z` }));
  let node = buildThread(chain, 'latest')[0];
  let max = 0;
  while (node) {
    max = Math.max(max, node.depth);
    node = node.replies[0];
  }
  assert.equal(max, 4);
});

test('post and comment checks', () => {
  assert.equal(validatePost({ title: 'short', body: 'a long enough body here' }).ok, false);
  assert.equal(validatePost({ title: 'A proper title', body: 'tiny' }).ok, false);
  assert.equal(validatePost({ title: 'A proper title', body: 'A proper body of text.' }).ok, true);
  assert.equal(validateComment('  ').ok, false);
  assert.equal(validateComment('x'.repeat(1001)).ok, false);
  assert.equal(validateComment('Salamat!').ok, true);
});

test('sample data is consistent', () => {
  const ids = new Set(MOCK_POSTS.map((p) => p.id));
  const commentIds = new Set(MOCK_COMMENTS.map((c) => c.id));
  assert.equal(ids.size, MOCK_POSTS.length);
  assert.equal(commentIds.size, MOCK_COMMENTS.length);
  for (const p of MOCK_POSTS) assert.ok(profileById(p.authorId), `post author ${p.authorId}`);
  for (const c of MOCK_COMMENTS) {
    assert.ok(ids.has(c.postId), `comment ${c.id} post`);
    assert.ok(profileById(c.authorId), `comment author ${c.authorId}`);
    if (c.parentId) assert.equal(MOCK_COMMENTS.find((x) => x.id === c.parentId)?.postId, c.postId, `parent of ${c.id}`);
  }
  for (const t of TESTIMONIALS) assert.ok(profileById(t.profileId), `testimonial ${t.profileId}`);
  assert.equal(new Set(PROFILES.map((p) => p.id)).size, PROFILES.length);
  assert.ok(TESTIMONIALS.some((t) => t.lang === 'tl') && TESTIMONIALS.some((t) => t.lang === 'en'));
});

test('an unknown author still gets a card', () => {
  assert.equal(resolveAuthor('u-123', 'Ana Reyes').name, 'Ana Reyes');
  assert.equal(resolveAuthor('maricel').place, 'Iligan City');
});

test('every sample person has a drawn face and made-up ones are stable', () => {
  for (const p of PROFILES) assert.ok(p.look, `${p.id} has a look`);
  assert.deepEqual(lookFromSeed('abc-123'), lookFromSeed('abc-123'));
  assert.ok(resolveAuthor('some-new-user').look);
  const skins = new Set(PROFILES.map((p) => p.look!.skin));
  assert.ok(skins.size >= 3, 'a spread of skin tones');
});

test('database rows become posts and comments; broken rows are skipped', async () => {
  const { commentFromRow, postFromRow, upsertById, writeErrorMessage } = await import('@/lib/community/rows');
  const row = { id: 'a', author_id: 'u1', sample_author: null, title: 'T', body: 'B', author_name: 'Maria', author_title: 'Teacher', author_avatar_path: null, author_avatar_preset: 'p3', score: 4, comment_count: 2, is_sample: false, created_at: '2026-11-01T00:00:00Z', project_href: '/projects?q=x', project_title: 'Road' };
  const post = postFromRow(row);
  assert.equal(post?.authorId, 'u1');
  assert.equal(post?.authorTitle, 'Teacher');
  assert.equal(post?.commentCount, 2);
  assert.equal(post?.project?.href, '/projects?q=x');
  assert.equal(postFromRow({ ...row, is_sample: true, author_id: null, sample_author: 'ramon' })?.authorId, 'ramon', 'a sample post points at its made-up person');
  assert.equal(postFromRow({ ...row, id: null }), null);
  assert.equal(postFromRow(null), null);
  assert.equal(commentFromRow({ id: 'c', post_id: 'a', parent_id: null, author_id: 'u1', body: 'hi', created_at: '2026-11-01T00:00:00Z', score: 1 })?.postId, 'a');
  assert.equal(commentFromRow({ id: 'c', body: 'hi' }), null);
  assert.deepEqual(upsertById([{ id: 'x', n: 1 }, { id: 'y', n: 2 }], { id: 'y', n: 3 }), [{ id: 'x', n: 1 }, { id: 'y', n: 3 }]);
  assert.equal(upsertById([{ id: 'x' }], { id: 'z' })[0].id, 'z', 'new items go first');
  assert.match(writeErrorMessage({ code: 'P0001', message: 'You are posting too fast.' }), /too fast/);
  assert.match(writeErrorMessage({ code: '42501' }), /sign in/);
});
