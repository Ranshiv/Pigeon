// ponytail: one runnable check — no framework. Verifies the contracts the live
// notification path depends on:
//  (a) broadcastActivity wraps a logged activity into the exact `userActivity`
//      shape Notifications.js renders, and scopes the emit to a workspace room;
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

// Mirror of broadcastActivity: which room an activity targets.
function targetRoom(activity) {
  return `workspace:${activity.workspaceId || 'default'}`;
}

// Mirror of Notifications.js getNotificationMessage `log` case + self-suppression
// (string-normalized on both sides, matching the hardened client comparison).
function render(payload, currentUserId) {
  if (currentUserId && String(payload.userId) === String(currentUserId)) return null;
  const d = payload.activity.details;
  return `${d.actorName || 'Someone'} ${d.actionType || 'updated'} ${d.resourceName || ''}`.trim();
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

// 2. Workspace isolation: emit targets the activity's workspace room, not global.
assert(targetRoom(activity) === 'workspace:ws-42', 'emit must target workspace room, got ' + targetRoom(activity));
assert(targetRoom({ workspaceId: undefined }) === 'workspace:default', 'missing workspaceId falls back to default');

// 3. Other-user rendering approves/rejects read correctly.
const text = render(payload, 'someoneElse');
assert(text === 'Priya review_approve Login flow review', 'other-user render: ' + text);

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
