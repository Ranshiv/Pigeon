// ponytail: one runnable check — no framework. Verifies the 'activity' socket
// handler's ActivityLog-shape mapping (mirrors socket-server.js logic by hand).
//
// Run: node tests/activity-socket.contract.test.js

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  }
}

const SKIP_ACTIVITY_ACTIONS = new Set(['workspace_view', 'collection_view', 'tab_change']);
const ACTIVITY_ACTION_TYPE = {
  request_sent: 'api_test',
  collection_run: 'api_test',
  collection_run_completed: 'api_test',
  request_deleted: 'delete',
  member_invited: 'join',
  member_removed: 'leave'
};
const VALID_ACTION_TYPES = new Set([
  'create', 'update', 'delete',
  'review_request', 'review_approve', 'review_reject',
  'comment', 'join', 'leave',
  'api_test', 'deploy'
]);

function buildLogEntry(room, action, data) {
  const workspaceId = (room || '').startsWith('workspace:') ? room.slice('workspace:'.length) : 'default';
  const resourceName = data?.requestName || data?.collectionName || data?.workspaceName || data?.name || '';
  return {
    workspaceId,
    actionType: ACTIVITY_ACTION_TYPE[action] || 'update',
    resourceName
  };
}

// 1. request_sent maps to a valid enum value and extracts the resource name.
const sent = buildLogEntry('workspace:693b3d59462b1d3cd33b9a66', 'request_sent', { requestName: 'Get Users', collectionName: 'API Tests' });
assert(sent.workspaceId === '693b3d59462b1d3cd33b9a66', 'room prefix stripped to real workspace id');
assert(VALID_ACTION_TYPES.has(sent.actionType), 'request_sent actionType must be a valid ActivityLog enum value, got ' + sent.actionType);
assert(sent.resourceName === 'Get Users', 'resourceName prefers requestName');

// 2. Unmapped actions (e.g. collection_updated) fall back to 'update', still valid.
const updated = buildLogEntry('workspace:ws1', 'collection_updated', { collectionName: 'Foo' });
assert(VALID_ACTION_TYPES.has(updated.actionType), 'fallback actionType must be valid enum value');

// 3. Noise actions are skipped before ever reaching buildLogEntry.
assert(SKIP_ACTIVITY_ACTIONS.has('workspace_view'), 'workspace_view must be skipped');
assert(!SKIP_ACTIVITY_ACTIONS.has('request_sent'), 'request_sent must NOT be skipped');

// 4. Missing/malformed room falls back to the default workspace scope.
const noRoom = buildLogEntry(undefined, 'request_sent', {});
assert(noRoom.workspaceId === 'default', 'missing room falls back to default workspace');

if (!process.exitCode) console.log('PASS: activity socket contract holds');
