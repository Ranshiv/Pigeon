// client/src/components/asyncapi/AsyncApiDesigner.js
// Channel/message list on one side, editor pane on the other. Overlays via
// AsyncApiModal for create/edit forms (no nested containers, no alert popups).
// Sub-entity edits happen via whole-document PUT — ponytail on routes/asyncapi.js.
import React, { useEffect, useState } from 'react';
import { FiEdit2, FiPlus, FiRadio, FiSave, FiServer, FiTrash2, FiZap } from 'react-icons/fi';
import AppSelect from '../common/AppSelect/AppSelect';
import AsyncApiModal from './AsyncApiModal';

const PROTOCOL_OPTIONS = [
    { value: 'websocket', label: 'WebSocket' },
    { value: 'socketio', label: 'Socket.IO' },
    { value: 'mqtt', label: 'MQTT' },
    { value: 'http', label: 'HTTP (webhook)' },
    { value: 'kafka', label: 'Kafka' },
    { value: 'amqp', label: 'AMQP (amqp/amqps)' },
    { value: 'nats', label: 'NATS' },
    { value: 'stomp', label: 'STOMP' },
    { value: 'other', label: 'Other / unspecified' }
];
const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'deprecated', label: 'Deprecated' }
];

const blankServer = () => ({ name: '', url: '', protocol: 'websocket', description: '', security: '' });
const blankChannel = () => ({ name: '', address: '', description: '', bindings: {} });
const blankMessage = () => ({ name: '', title: '', description: '', contentType: 'application/json', payloadSchema: {}, payloadExample: '', headersSchema: {}, headersExample: '' });
const blankOperation = () => ({ channelName: '', action: 'publish', messageName: '', summary: '' });

const ACTIONS = [{ value: 'publish', label: 'Publish' }, { value: 'subscribe', label: 'Subscribe' }];

function asArray(value) { return Array.isArray(value) ? value : []; }

// Forms use singular entity names, while the persisted document stores plural
// arrays. Keeping this mapping explicit prevents a draft from being written to
// an unused `server` / `channel` property on the document object.
const entityKind = (kind) => String(kind || '').replace(/s$/, '');
const entityListKey = (kind) => `${entityKind(kind)}s`;

const AsyncApiDesigner = ({ document: doc, onChange }) => {
    const [tab, setTab] = useState('channels');
    const [editing, setEditing] = useState(null); // { kind, index, draft }
    const [creating, setCreating] = useState(null); // { kind, draft }

    const patch = (updater) => {
        const next = { ...doc, ...updater(doc) };
        onChange?.(next);
    };

    const startEdit = (kind, index, value) => setEditing({
        kind: entityKind(kind), listKey: kind, index, draft: JSON.parse(JSON.stringify(value))
    });
    const startCreate = (kind) => {
        const normalizedKind = entityKind(kind);
        setCreating({
            kind: normalizedKind,
            draft: normalizedKind === 'server' ? blankServer()
                : normalizedKind === 'channel' ? blankChannel()
                : normalizedKind === 'message' ? blankMessage()
                : blankOperation()
        });
    };

    // Auto-switch to messages tab when there's only the implicit operation tab empty.
    useEffect(() => {
        if (!asArray(doc.channels).length && tab === 'channels') setTab('overview');
    }, [doc.channels, tab]);

    const saveEdit = async () => {
        if (!editing) return;
        const { listKey, index, draft } = editing;
        const saved = await Promise.resolve(onChange?.({
            ...doc,
            [listKey]: asArray(doc[listKey]).map((item, itemIndex) => itemIndex === index ? draft : item)
        }));
        if (saved !== false) setEditing(null);
    };
    const saveCreate = async () => {
        if (!creating) return;
        const { kind, draft } = creating;
        const listKey = entityListKey(kind);
        const saved = await Promise.resolve(onChange?.({
            ...doc,
            [listKey]: [...asArray(doc[listKey]), draft]
        }));
        if (saved !== false) setCreating(null);
    };
    const remove = (kind, index) => patch((d) => {
        const list = asArray(d[kind] || []).slice();
        list.splice(index, 1);
        return { [kind]: list };
    });

    const renderList = () => {
        const items = asArray(doc[tab] || []);
        if (items.length === 0) {
            return <div className="aa-empty"><strong>No {tab} yet.</strong><span>Add one with the New button.</span></div>;
        }
        return (
            <ul className="aa-list">
                {items.map((item, i) => (
                    <li key={i}
                        className="aa-list-item"
                        tabIndex={0}
                        onClick={() => startEdit(tab, i, item)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(tab, i, item); } }}
                    >
                        <div className="aa-list-item-main">
                            <span className="aa-list-item-name">{listItemName(tab, item)}</span>
                            <span className="aa-list-item-meta">{listItemMeta(tab, item, doc)}</span>
                        </div>
                        <div className="aa-actions-cell">
                            <button className="aa-btn aa-btn--ghost aa-btn--sm" title="Edit" onClick={(e) => { e.stopPropagation(); startEdit(tab, i, item); }}><FiEdit2 size={12} /></button>
                            <button className="aa-btn aa-btn--danger aa-btn--sm" title="Remove" onClick={(e) => { e.stopPropagation(); remove(tab, i); }}><FiTrash2 size={12} /></button>
                        </div>
                    </li>
                ))}
            </ul>
        );
    };

    const TABS = [
        { value: 'overview', label: 'Overview' },
        { value: 'servers', label: `Servers (${asArray(doc.servers).length})` },
        { value: 'channels', label: `Channels (${asArray(doc.channels).length})` },
        { value: 'messages', label: `Messages (${asArray(doc.messages).length})` },
        { value: 'operations', label: `Operations (${asArray(doc.operations).length})` }
    ];

    const draftToRender = editing || creating;
    const draftKind = draftToRender?.kind;
    const draft = draftToRender?.draft;
    const setDraft = (updater) => {
        const next = typeof updater === 'function' ? updater(draft) : updater;
        if (editing) setEditing({ ...editing, draft: next });
        else setCreating({ ...creating, draft: next });
    };
    const open = Boolean(editing || creating);
    const title = (editing ? 'Edit ' : 'New ') + (draftKind ? draftKind.charAt(0).toUpperCase() + draftKind.slice(1) : '');

    return (
        <div className="aa-designer">
            <div className="aa-section">
                <div className="aa-section-title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {tab === 'overview' ? <FiRadio /> : tab === 'servers' ? <FiServer /> : tab === 'messages' ? <FiZap /> : <FiRadio />}
                        Document model
                    </span>
                    {tab !== 'overview' && (
                        <button className="aa-btn aa-btn--primary aa-btn--sm" onClick={() => startCreate(tab)}>
                            <FiPlus size={12} /> New {tab.slice(0, -1)}
                        </button>
                    )}
                </div>
                <AppSelect value={tab} onChange={setTab} options={TABS} />
                {tab === 'overview' ? <Overview doc={doc} onSave={onChange} onCreate={startCreate} /> : renderList()}
            </div>

            <AsyncApiModal
                open={open}
                title={title}
                onClose={() => { setEditing(null); setCreating(null); }}
                footer={
                    <button className="aa-btn aa-btn--primary" onClick={editing ? saveEdit : saveCreate}>Save</button>
                }
            >
                {draft && draftKind === 'server' && <ServerForm draft={draft} setDraft={setDraft} />}
                {draft && draftKind === 'channel' && <ChannelForm draft={draft} setDraft={setDraft} doc={doc} />}
                {draft && draftKind === 'message' && <MessageForm draft={draft} setDraft={setDraft} />}
                {draft && draftKind === 'operation' && <OperationForm draft={draft} setDraft={setDraft} doc={doc} />}
            </AsyncApiModal>
        </div>
    );
};

function listItemName(kind, item) {
    if (kind === 'servers') return item.name || 'Unnamed server';
    if (kind === 'channels') return item.name || item.address || 'Unnamed channel';
    if (kind === 'messages') return item.name || item.title || 'Unnamed message';
    if (kind === 'operations') return `${item.action} → ${item.channelName || '(channel)'}`;
    return '';
}
function listItemMeta(kind, item, doc) {
    if (kind === 'servers') return `${item.protocol || ''} ${item.url || ''}`.trim();
    if (kind === 'channels') return asArray(doc.operations).filter((o) => o.channelName === item.name || o.channelName === item.address).map((o) => o.action).join(', ');
    if (kind === 'messages') return item.contentType || '';
    if (kind === 'operations') return item.messageName || '';
    return '';
}

function ServerForm({ draft, setDraft }) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    return (
        <>
            <div className="aa-field"><label>Name</label><input className="aa-input" value={draft.name} onChange={set('name')} placeholder="production" /></div>
            <div className="aa-field"><label>URL</label><input className="aa-input" value={draft.url} onChange={set('url')} placeholder="wss://echo.websocket.org" /></div>
            <div className="aa-field"><label>Protocol</label><AppSelect value={draft.protocol} onChange={(v) => setDraft({ ...draft, protocol: v })} options={PROTOCOL_OPTIONS} /></div>
            <div className="aa-field"><label>Description</label><input className="aa-input" value={draft.description} onChange={set('description')} /></div>
            <div className="aa-field"><label>Security (env-var placeholder, e.g. <code>{'{{ASYNCAPI_SECRET}}'}</code>)</label><input className="aa-input" value={draft.security} onChange={set('security')} placeholder="{{ASYNCAPI_SECRET}}" /></div>
        </>
    );
}

function ChannelForm({ draft, setDraft }) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    return (
        <>
            <div className="aa-field"><label>Name</label><input className="aa-input" value={draft.name} onChange={set('name')} placeholder="user/signedup" /></div>
            <div className="aa-field"><label>Address</label><input className="aa-input" value={draft.address} onChange={set('address')} placeholder="user/signedup (MQTT topic / WS path)" /></div>
            <div className="aa-field"><label>Description</label><input className="aa-input" value={draft.description} onChange={set('description')} /></div>
        </>
    );
}

function MessageForm({ draft, setDraft }) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    const setSchema = (field) => (e) => {
        let parsed = {};
        try { parsed = JSON.parse(e.target.value || '{}'); } catch { parsed = e.target.value; }
        setDraft({ ...draft, [field]: parsed });
    };
    const schemaText = (s) => typeof s === 'string' ? s : JSON.stringify(s || {}, null, 2);
    return (
        <>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Name</label><input className="aa-input" value={draft.name} onChange={set('name')} placeholder="UserSignedUp" /></div>
                <div className="aa-field"><label>Title</label><input className="aa-input" value={draft.title} onChange={set('title')} /></div>
            </div>
            <div className="aa-field"><label>Description</label><input className="aa-input" value={draft.description} onChange={set('description')} /></div>
            <div className="aa-field"><label>Content-Type</label><input className="aa-input" value={draft.contentType} onChange={set('contentType')} /></div>
            <div className="aa-field"><label>{'Payload schema (JSON-Schema)'}</label><textarea className="aa-textarea" value={schemaText(draft.payloadSchema)} onChange={setSchema('payloadSchema')} spellCheck={false} /></div>
            <div className="aa-field"><label>Payload example (JSON)</label><textarea className="aa-textarea" value={draft.payloadExample} onChange={set('payloadExample')} spellCheck={false} placeholder='{"userId": "abc"}' /></div>
            <div className="aa-field"><label>{'Headers schema (JSON-Schema)'}</label><textarea className="aa-textarea" value={schemaText(draft.headersSchema)} onChange={setSchema('headersSchema')} spellCheck={false} /></div>
            <div className="aa-field"><label>Headers example (JSON)</label><textarea className="aa-textarea" value={draft.headersExample} onChange={set('headersExample')} spellCheck={false} /></div>
        </>
    );
}

function OperationForm({ draft, setDraft, doc }) {
    const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
    const channelOptions = asArray(doc.channels).map((c) => ({ value: c.name || c.address || '', label: c.name || c.address || '(Unnamed channel)' }));
    if (!channelOptions.length) channelOptions.push({ value: '', label: '— add a channel first —' });
    const messageOptions = asArray(doc.messages).map((m) => ({ value: m.name || '', label: m.name || '(Unnamed message)' }));
    if (!messageOptions.length) messageOptions.push({ value: '', label: '— add a message first —' });
    return (
        <>
            <div className="aa-field"><label>Channel</label><AppSelect value={draft.channelName} onChange={(v) => setDraft({ ...draft, channelName: v })} options={channelOptions} /></div>
            <div className="aa-field"><label>Action</label><AppSelect value={draft.action} onChange={(v) => setDraft({ ...draft, action: v })} options={ACTIONS} /></div>
            <div className="aa-field"><label>Message</label><AppSelect value={draft.messageName} onChange={(v) => setDraft({ ...draft, messageName: v })} options={messageOptions} /></div>
            <div className="aa-field"><label>Summary</label><input className="aa-input" value={draft.summary} onChange={set('summary')} /></div>
        </>
    );
}

const Overview = ({ doc, onSave, onCreate }) => {
    const [draft, setDraft] = useState(() => ({ ...doc, tags: asArray(doc.tags) }));

    // Keep text entry local. Saving the parent document on each keypress made
    // network responses race the controlled input and caused dropped typing.
    useEffect(() => {
        setDraft({ ...doc, tags: asArray(doc.tags) });
    }, [doc._id]);

    const set = (k) => (e) => setDraft((current) => ({ ...current, [k]: e.target.value }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="aa-field"><label>Name</label><input className="aa-input" value={draft.name || ''} onChange={set('name')} /></div>
            <div className="aa-field"><label>Description</label><input className="aa-input" value={draft.description || ''} onChange={set('description')} /></div>
            <div className="aa-grid-2">
                <div className="aa-field"><label>Document version</label><input className="aa-input" value={draft.version || ''} onChange={set('version')} /></div>
                <div className="aa-field"><label>AsyncAPI version</label><input className="aa-input" value={draft.asyncApiVersion || '2.6.0'} onChange={set('asyncApiVersion')} /></div>
            </div>
            <div className="aa-field"><label>Status</label><AppSelect value={draft.status || 'draft'} onChange={(v) => setDraft((current) => ({ ...current, status: v }))} options={STATUS_OPTIONS} /></div>
            <div className="aa-field"><label>Tags (comma-separated)</label><input className="aa-input" value={asArray(draft.tags).join(', ')} onChange={(e) => setDraft((current) => ({ ...current, tags: (e.target.value || '').split(',').map((t) => t.trim()).filter(Boolean) }))} /></div>
            <div className="aa-overview-help">
                Build the event API by adding its server, channel, message, and operation.
            </div>
            <div className="aa-quick-actions" aria-label="Add AsyncAPI entities">
                <button type="button" className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => onCreate?.('server')}>
                    <FiServer size={13} /> Add server
                </button>
                <button type="button" className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => onCreate?.('channel')}>
                    <FiRadio size={13} /> Add channel
                </button>
                <button type="button" className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => onCreate?.('message')}>
                    <FiZap size={13} /> Add message
                </button>
                <button type="button" className="aa-btn aa-btn--ghost aa-btn--sm" onClick={() => onCreate?.('operation')}>
                    <FiPlus size={13} /> Add operation
                </button>
            </div>
            <div className="aa-overview-actions">
                <button className="aa-btn aa-btn--primary" type="button" onClick={() => onSave?.(draft)}>
                    <FiSave /> Save document details
                </button>
            </div>
        </div>
    );
};

export default AsyncApiDesigner;
