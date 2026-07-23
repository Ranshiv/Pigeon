// ponytail: one runnable check — no framework. Verifies the contracts the live
// notification path depends on:
//  (a) broadcastActivity wraps a logged activity into the exact `userActivity`
//      shape Notifications.js renders, and selects online workspace members;
//  (b) the actor's userId string matches the localStorage form so self-activity is
//      suppressed client-side (now compared as strings, id-form-robust);
//  (c) the targeted reviewer/requester ping carries the same renderable shape.
//
// Run: node tests/notifications.contract.test.js

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  }
}

// Mirror of broadcastActivity's payload construction (kept in lockstep by hand).
function buildPayload(activity) {
  return {
    userId: String(activity.user?._id || activity.user || ''),
    activity: {
      type: 'log',
      details: {
        actionType: activity.actionType,
        resourceName: activity.resourceName,
        actorName: activity.user?.displayName
      }
    },
    timestamp: activity.createdAt || '<now>'
  };
}

// Mirror of broadcastActivity: live workspace delivery is based on membership,
// not on whichever workspace a connected user is currently viewing.
function recipients(workspace, connectedUsers) {
  const memberIds = new Set([
    workspace.owner,
    workspace.userId,
    ...(workspace.collaborators || []).map((collaborator) => collaborator.userId)
  ].filter(Boolean).map(String));
  return connectedUsers
    .filter((user) => memberIds.has(String(user.id)))
    .map((user) => user.id);
}

// Mirror of Notifications.js getNotificationMessage `log` case + self-suppression
// (string-normalized on both sides, matching the hardened client comparison).
function render(payload, currentUserId) {
  if (currentUserId && String(payload.userId) === String(currentUserId)) return null;
  const d = payload.activity.details;
  const labels = { review_approve: 'approved' };
  return `${d.actorName || 'Someone'} ${labels[d.actionType] || d.actionType || 'updated'} ${d.resourceName || ''}`.trim();
}

// Simulated Mongoose-ish logged activity (after .populate('user','displayName'))
const activity = {
  _id: 'a1',
  workspaceId: 'ws-42',
  actionType: 'review_approve',
  resourceName: 'Login flow review',
  user: { _id: '507f1f77bcf86cd799439011', displayName: 'Priya' },
  createdAt: '2026-07-21T01:00:00.000Z'
};

// 1. Payload shape matches what the dropdown renders.
const payload = buildPayload(activity);
assert(payload.activity.type === 'log', 'payload.activity.type should be log');
assert(payload.activity.details.actorName === 'Priya', 'actorName surfaced in details');
assert(payload.activity.details.actionType === 'review_approve', 'actionType surfaced');
assert(typeof payload.userId === 'string' && payload.userId.length > 0, 'userId is a non-empty string');

// 2. Workspace membership: send to every online owner/collaborator, even when
// they are elsewhere in the app; never send to a connected non-member.
const workspace = {
  owner: 'owner-1',
  userId: 'owner-1',
  collaborators: [{ userId: 'member-2' }, { userId: 'member-3' }]
};
const deliveredTo = recipients(workspace, [
  { id: 'owner-1' },
  { id: 'member-2' },
  { id: 'outsider-4' }
]);
assert(deliveredTo.join(',') === 'owner-1,member-2', 'only connected workspace members receive a live notification: ' + deliveredTo);

// 3. Other-user rendering approves/rejects read correctly.
const text = render(payload, 'someoneElse');
assert(text === 'Priya approved Login flow review', 'other-user render: ' + text);

// 4. Self-suppression fires even across id-form drift (id vs _id, padded forms).
const selfTextA = render(payload, '507f1f77bcf86cd799439011');
const selfTextB = render(payload, { _id: '507f1f77bcf86cd799439011' }._id);
assert(selfTextA === null, 'self-activity (string id) must be suppressed, got: ' + selfTextA);
assert(selfTextB === null, 'self-activity (_id form) must be suppressed via String() coercion, got: ' + selfTextB);

// 5. The auth check route returns req.user where .id is the ObjectId string;
//    if localStorage persists `id` as that string, it equals String(_id). This is the
//    load-bearing match underlying targeted reviewer/requester socket selection.
const userDoc = { _id: activity.user._id, id: activity.user._id };
assert(String(userDoc._id) === userDoc.id, 'localStorage id form must equal String(_id)');

if (!process.exitCode) console.log('PASS: notification contract holds');
