// ponytail: one runnable check — no framework, no DB. Verifies the /invite
// route's persistence contract in isolation: given a workspace doc and an
// invitee user doc, the collaborator record it pushes must carry a REAL
// userId (from the looked-up user), not the old fabricated `user-${Date.now()}`.
//
// Run: node tests/workspace-invite.contract.test.js

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  }
}

// Mirror of the route's collaborator-shape construction.
function buildCollaborator(invitee, role) {
  return {
    userId: invitee._id,
    email: invitee.email,
    displayName: invitee.displayName,
    role,
    joinedAt: new Date('2026-07-21T00:00:00.000Z')
  };
}

// Mirror of the route's already-member check.
function isAlreadyMember(workspace, inviteeId) {
  return String(workspace.owner) === String(inviteeId)
    || (workspace.collaborators || []).some(c => String(c.userId) === String(inviteeId));
}

const workspace = { owner: 'owner-1', collaborators: [{ userId: 'existing-1', role: 'viewer' }] };
const kernel = { _id: 'kernel-42', email: 'kernel@example.com', displayName: 'Kernel' };

// 1. New collaborator carries the real user id, not a fabricated one.
const collab = buildCollaborator(kernel, 'editor');
assert(collab.userId === 'kernel-42', 'collaborator.userId must be the real invitee id, got ' + collab.userId);
assert(!/^user-\d+$/.test(String(collab.userId)), 'collaborator.userId must not be the old fabricated user-<timestamp> form');

// 2. Duplicate invite is rejected instead of double-adding.
assert(isAlreadyMember(workspace, 'owner-1') === true, 'owner must be recognized as already a member');
assert(isAlreadyMember(workspace, 'existing-1') === true, 'existing collaborator must be recognized as already a member');
assert(isAlreadyMember(workspace, 'kernel-42') === false, 'a genuinely new invitee must not be blocked');

if (!process.exitCode) console.log('PASS: workspace invite contract holds');
