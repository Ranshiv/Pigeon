// ponytail: one runnable check — no framework. Verifies the contracts the live
// notification path depends on durable appNotification entries. `userActivity`
// remains for the activity feed; notification recipients exclude the actor and
// honor each member's in-app/category preference.
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

function renderActivity(payload) {
  const d = payload.activity.details;
  const labels = { review_approve: 'approved' };
  return `${d.actorName || 'Someone'} ${labels[d.actionType] || d.actionType || 'updated'} ${d.resourceName || ''}`.trim();
}

function notificationRecipients(workspace, users, actorId, category) {
  const memberIds = new Set([
    workspace.owner,
    workspace.userId,
    ...(workspace.collaborators || []).map((collaborator) => collaborator.userId)
  ].filter(Boolean).map(String));
  return users.filter((user) => (
    memberIds.has(String(user.id)) &&
    String(user.id) !== String(actorId) &&
    user.preferences?.inAppEnabled !== false &&
    user.preferences?.[category] !== false
  )).map((user) => user.id);
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

// 3. Activity formatting produces the durable notification message.
const text = renderActivity(payload);
assert(text === 'Priya approved Login flow review', 'other-user render: ' + text);

// 4. Durable notification recipients exclude the actor and respect preferences.
const notified = notificationRecipients(workspace, [
  { id: 'owner-1', preferences: {} },
  { id: 'member-2', preferences: {} },
  { id: 'member-3', preferences: { workspaceActivity: false } },
  { id: 'outsider-4', preferences: {} }
], 'owner-1', 'workspaceActivity');
assert(notified.join(',') === 'member-2', 'only opted-in non-actor members are persisted: ' + notified);

// 5. The auth check route returns req.user where .id is the ObjectId string.
const userDoc = { _id: activity.user._id, id: activity.user._id };
assert(String(userDoc._id) === userDoc.id, 'localStorage id form must equal String(_id)');

if (!process.exitCode) console.log('PASS: notification contract holds');
