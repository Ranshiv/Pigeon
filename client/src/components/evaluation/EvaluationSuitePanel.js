// client/src/components/evaluation/EvaluationSuitePanel.js
// Visual editor + transcript scorer for collection-scoped AI-agent evaluation
// suites. Two-pane layout: left = suites/scenarios/run controls; right = form.
import React, { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiCheckCircle, FiXCircle, FiRefreshCw, FiPlay, FiTarget, FiEdit2, FiSave, FiX, FiArrowLeft, FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import './EvaluationSuitePanel.css';
import '../../styles/animations.css';
import { useCopilotPageContext } from '../../context/CopilotContext';

const ASSERTION_OPERATORS = [
    { value: 'equals', label: 'equals' },
    { value: 'contains', label: 'contains' },
    { value: 'exists', label: 'exists' },
    { value: 'notExists', label: 'notExists' }
];

const EMPTY_SCENARIO = {
    _id: null,
    name: '',
    objective: '',
    requiredToolCalls: [],
    forbiddenToolCalls: [],
    argumentAssertions: [],
    maxToolCalls: null
};

const readPayload = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'The evaluation request failed.');
    return payload;
};

const summarizeRunResult = (run) => {
    const status = run?.status === 'passed' ? 'passed' : run?.status === 'error' ? 'error' : 'failed';
    const score = run?.score || '0/0';
    const violations = Array.isArray(run?.violations) ? run.violations.map((v) => ({
        kind: v.kind, toolName: v.toolName || '', message: v.message || ''
    })) : [];
    const scenarioRows = Array.isArray(run?.scenarioResults) ? run.scenarioResults.map((s) => ({
        name: s.name || '', status: s.status === 'passed' ? 'passed' : 'failed', score: s.score || '0/0'
    })) : [];
    return { status, score, violationCount: violations.length, violations, scenarioRows };
};

const EvaluationSuitePanel = ({ collectionId, workspaceId }) => {
    const requestedSuiteId = new URLSearchParams(window.location.search).get('suite');
    const requestedRunId = new URLSearchParams(window.location.search).get('run');
    const [suites, setSuites] = useState([]);
    const [toolNames, setToolNames] = useState([]);
    const [state, setState] = useState('loading');
    const [selectedSuiteId, setSelectedSuiteId] = useState(null);
    const [selectedSuite, setSelectedSuite] = useState(null);
    const [expandedSuiteId, setExpandedSuiteId] = useState(null);
    const [activePanel, setActivePanel] = useState('list'); // 'list' | 'suite-form' | 'scenario-form' | 'run'
    const [editingScenario, setEditingScenario] = useState(null);
    const [editingSuite, setEditingSuite] = useState(false);
    const [creatingSuite, setCreatingSuite] = useState(false);
    const [suiteForm, setSuiteForm] = useState({ name: '', description: '', enabled: true });
    const [transcriptText, setTranscriptText] = useState('');
    const [lastRun, setLastRun] = useState(null);
    const [history, setHistory] = useState([]);
    const [running, setRunning] = useState(false);
    const [runError, setRunError] = useState('');
    const [deepLinkOpened, setDeepLinkOpened] = useState(false);

    useCopilotPageContext((lastRun?.id || lastRun?._id) ? {
        type: 'test_run',
        kind: 'evaluation',
        id: lastRun.id || lastRun._id,
        workspaceId: workspaceId || '',
        label: `${selectedSuite?.name || 'Agent evaluation'} · ${lastRun.status || 'run'}`
    } : null);

    const loadSuites = useCallback(async () => {
        setState('loading');
        try {
            const payload = await readPayload(await fetch(`/api/evaluation/collections/${collectionId}/suites`, { credentials: 'include' }));
            setSuites(payload.suites || []);
            setToolNames(payload.toolNames || []);
            setState('ready');
        } catch (error) {
            setState('error');
            toast.error(error.message || 'Unable to load evaluation suites.');
        }
    }, [collectionId]);

    useEffect(() => { loadSuites(); }, [loadSuites]);

    const openSuite = useCallback(async (suiteId) => {
        if (!suiteId) { setSelectedSuiteId(null); setSelectedSuite(null); setExpandedSuiteId(null); setActivePanel('list'); return; }
        if (expandedSuiteId === suiteId) { setSelectedSuiteId(null); setSelectedSuite(null); setExpandedSuiteId(null); setEditingSuite(false); setActivePanel('list'); return; }
        try {
            const payload = await readPayload(await fetch(`/api/evaluation/suites/${suiteId}`, { credentials: 'include' }));
            setSelectedSuiteId(suiteId);
            setSelectedSuite(payload.suite);
            setExpandedSuiteId((current) => current === suiteId ? null : suiteId);
            setToolNames(payload.toolNames || toolNames);
            setSuiteForm({
                name: payload.suite.name || '',
                description: payload.suite.description || '',
                enabled: payload.suite.enabled !== false
            });
            setEditingScenario(null);
            setActivePanel('list');
            const hist = await readPayload(await fetch(`/api/evaluation/suites/${suiteId}/runs?limit=20`, { credentials: 'include' }));
            const runHistory = hist.runs || [];
            setHistory(runHistory);
            const requestedRun = runHistory.find((run) => String(run.id || run._id) === String(requestedRunId));
            if (requestedRun) { setLastRun(requestedRun); setActivePanel('run'); }
        } catch (error) {
            toast.error(error.message || 'Unable to load the suite.');
        }
    }, [toolNames, expandedSuiteId, requestedRunId]);

    useEffect(() => {
        if (state !== 'ready' || !requestedSuiteId || deepLinkOpened) return;
        setDeepLinkOpened(true);
        openSuite(requestedSuiteId);
    }, [state, requestedSuiteId, deepLinkOpened, openSuite]);

    const createSuite = async () => {
        if (!suiteForm.name.trim()) { toast.error('Suite name is required.'); return; }
        try {
            const res = await fetch(`/api/evaluation/collections/${collectionId}/suites`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: suiteForm.name,
                    description: suiteForm.description,
                    enabled: suiteForm.enabled
                })
            });
            const suite = await readPayload(res);
            setSuites((prev) => [suite, ...prev]);
            setSuiteForm({ name: '', description: '', enabled: true });
            setCreatingSuite(false);
            await openSuite(suite.id);
            toast.success('Suite created.');
        } catch (error) { toast.error(error.message); }
    };

    const saveSuiteForm = async () => {
        if (!suiteForm.name.trim()) { toast.error('Suite name is required.'); return; }
        try {
            const updated = await readPayload(await fetch(`/api/evaluation/suites/${selectedSuiteId}`, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: suiteForm.name, description: suiteForm.description, enabled: suiteForm.enabled })
            }));
            setSelectedSuite(updated);
            setSuites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setEditingSuite(false);
            setActivePanel('list');
            toast.success('Suite updated.');
        } catch (error) { toast.error(error.message); }
    };

    const deleteSuite = async (suiteId) => {
        if (!window.confirm('Delete this suite, its scenarios, and run history?')) return;
        try {
            await readPayload(await fetch(`/api/evaluation/suites/${suiteId}`, { method: 'DELETE', credentials: 'include' }));
            setSuites((prev) => prev.filter((s) => s.id !== suiteId));
            if (selectedSuiteId === suiteId) { setSelectedSuiteId(null); setSelectedSuite(null); setActivePanel('list'); }
            toast.success('Suite deleted.');
        } catch (error) { toast.error(error.message); }
    };

    const startNewScenario = () => { setEditingScenario({ ...EMPTY_SCENARIO, suiteId: selectedSuiteId }); setActivePanel('scenario-form'); };
    const editScenario = (scenario) => { setEditingScenario({ ...scenario }); setActivePanel('scenario-form'); };

    const saveScenario = async () => {
        const s = editingScenario;
        if (!s.name.trim()) { toast.error('Scenario name is required.'); return; }
        const body = {
            name: s.name, objective: s.objective,
            requiredToolCalls: s.requiredToolCalls || [],
            forbiddenToolCalls: s.forbiddenToolCalls || [],
            argumentAssertions: s.argumentAssertions || [],
            maxToolCalls: s.maxToolCalls
        };
        try {
            const url = s._id ? `/api/evaluation/scenarios/${s._id}` : `/api/evaluation/suites/${s.suiteId}/scenarios`;
            const method = s._id ? 'PUT' : 'POST';
            const saved = await readPayload(await fetch(url, {
                method, credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }));
            setSelectedSuite((prev) => prev && ({
                ...prev,
                scenarios: s._id
                    ? prev.scenarios.map((x) => (x.id === saved.id ? saved : x))
                    : [...(prev.scenarios || []), saved]
            }));
            setActivePanel('list');
            setEditingScenario(null);
            toast.success('Scenario saved.');
        } catch (error) { toast.error(error.message); }
    };

    const deleteScenario = async (scenarioId) => {
        if (!window.confirm('Delete this scenario and its runs?')) return;
        try {
            await readPayload(await fetch(`/api/evaluation/scenarios/${scenarioId}`, { method: 'DELETE', credentials: 'include' }));
            setSelectedSuite((prev) => prev && ({ ...prev, scenarios: (prev.scenarios || []).filter((x) => x.id !== scenarioId) }));
            if (editingScenario?._id === scenarioId) { setEditingScenario(null); setActivePanel('list'); }
            toast.success('Scenario deleted.');
        } catch (error) { toast.error(error.message); }
    };

    const toggleToolIn = (field, toolName) => {
        setEditingScenario((prev) => {
            const list = prev[field] || [];
            return { ...prev, [field]: list.includes(toolName) ? list.filter((x) => x !== toolName) : [...list, toolName] };
        });
    };

    const updateAssertion = (index, patch) => {
        setEditingScenario((prev) => {
            const next = [...(prev.argumentAssertions || [])];
            next[index] = { ...next[index], ...patch };
            return { ...prev, argumentAssertions: next };
        });
    };

    const addAssertion = () => setEditingScenario((prev) => ({
        ...prev,
        argumentAssertions: [...(prev.argumentAssertions || []), { toolName: toolNames[0] || '', path: '', operator: 'equals', expected: '' }]
    }));

    const removeAssertion = (index) => setEditingScenario((prev) => ({
        ...prev,
        argumentAssertions: (prev.argumentAssertions || []).filter((_, i) => i !== index)
    }));

    const runSuite = async () => {
        if (!selectedSuiteId) { setRunError('Open a suite before running it.'); return; }
        let transcript;
        try { transcript = JSON.parse(transcriptText); }
        catch { setRunError('Transcript must be valid JSON.'); toast.error('Transcript must be valid JSON.'); return; }
        setRunning(true);
        setRunError('');
        try {
            const run = await readPayload(await fetch(`/api/evaluation/suites/${selectedSuiteId}/runs`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transcript)
            }));
            setLastRun(run);
            setActivePanel('run');
            setHistory((prev) => [run, ...prev].slice(0, 20));
            toast.info(`Suite ${run.status}. Score ${run.score}.`);
        } catch (error) { setRunError(error.message || 'Unable to run suite.'); toast.error(error.message); }
        finally { setRunning(false); }
    };

    const ToolChips = ({ label, field }) => (
        <div className="eval-field">
            <label>{label}</label>
            <div className="tool-chips">
                {toolNames.length === 0 && <span className="hint">No MCP tools exposed. Configure the collection's MCP server first.</span>}
                {toolNames.map((name) => (
                    <button key={name} type="button"
                        className={`tool-chip ${(editingScenario[field] || []).includes(name) ? 'on' : ''}`}
                        onClick={() => toggleToolIn(field, name)}>
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );

    if (state === 'loading') return <div className="eval-panel"><p>Loading evaluation suites…</p></div>;
    if (state === 'error') return <div className="eval-panel"><p>Unable to load evaluation suites.</p><button className="eval-add-btn" onClick={loadSuites}><FiRefreshCw /> Retry</button></div>;

    // Suite list view with inline accordion details. Keep one render path so
    // the legacy two-pane detail layout cannot appear during state changes.
    if (state === 'ready') {
        return (
            <div className="eval-panel eval-list">
                <header className="eval-hero">
                    <div>
                        <span className="eval-eyebrow"><FiTarget /> Deterministic transcript scoring</span>
                        <h2>AI Agent Evaluation</h2>
                        <p>Create reusable suites that verify tool calls, arguments, and safety constraints against this collection.</p>
                    </div>
                    <button type="button" className="eval-add-btn eval-primary-action" onClick={() => { setSuiteForm({ name: '', description: '', enabled: true }); setCreatingSuite(true); }}><FiPlus /> New suite</button>
                </header>
                <ul className="eval-suite-list">
                    {suites.length === 0 && <li className="hint">No suites yet. Create one to start evaluating agent transcripts.</li>}
                    {suites.map((s) => (
                        <React.Fragment key={s.id}>
                            <li className={`eval-suite-row motion-transition-colors ${expandedSuiteId === s.id ? 'expanded' : ''}`}>
                                <button className="eval-suite-open motion-transition-transform" onClick={() => { setEditingSuite(false); openSuite(s.id); }} aria-expanded={expandedSuiteId === s.id}>
                                    <span className="eval-suite-chevron">{expandedSuiteId === s.id ? <FiChevronUp /> : <FiChevronDown />}</span>
                                    <span><strong>{s.name}</strong><span className="hint">{s.scenarios?.length || 0} scenarios · {s.enabled ? 'enabled' : 'disabled'}</span></span>
                                </button>
                                <div className="eval-suite-actions">
                                    <button className="eval-icon-btn" onClick={(event) => { event.stopPropagation(); if (expandedSuiteId !== s.id) openSuite(s.id); setEditingSuite(true); }} title="Edit suite"><FiEdit2 /></button>
                                    <button className="eval-icon-btn" onClick={() => deleteSuite(s.id)} title="Delete suite"><FiTrash2 /></button>
                                </div>
                            </li>
                            {expandedSuiteId === s.id && selectedSuite?.id === s.id && (
                                <li className="eval-inline-detail motion-slide-up">
                                    {editingSuite && <div className="eval-suite-edit eval-inline-edit motion-slide-down"><div className="eval-inline-edit-title"><strong>Edit suite</strong><span className="hint">Update the suite name or description.</span></div><div className="eval-form-row"><label>Suite name</label><input className="eval-input" value={suiteForm.name} onChange={(e) => setSuiteForm({ ...suiteForm, name: e.target.value })} /></div><div className="eval-form-row"><label>Description</label><textarea className="eval-textarea" rows={2} value={suiteForm.description} onChange={(e) => setSuiteForm({ ...suiteForm, description: e.target.value })} /></div><div className="eval-modal-actions"><button className="eval-cancel" onClick={() => setEditingSuite(false)}>Cancel</button><button className="eval-save" onClick={saveSuiteForm}><FiSave /> Save suite</button></div></div>}
                                    <div className="eval-section-head"><span>Scenarios</span><div className="eval-inline-actions"><button className="eval-add-btn small" onClick={startNewScenario}><FiPlus /> Add scenario</button></div></div>
                                    {(selectedSuite.scenarios || []).length === 0 ? <p className="hint">No scenarios yet.</p> : <ol className="eval-scenarios">{selectedSuite.scenarios.map((sc) => <li key={sc.id}><div className="eval-sc-head"><div><strong>{sc.name}</strong>{sc.objective && <p className="hint">{sc.objective}</p>}</div><div><button className="eval-icon-btn" onClick={() => editScenario(sc)} title="Edit scenario"><FiEdit2 /></button><button className="eval-icon-btn" onClick={() => deleteScenario(sc.id)} title="Delete scenario"><FiTrash2 /></button></div></div></li>)}</ol>}
                                    {activePanel === 'scenario-form' && editingScenario && <div className="eval-form-card eval-inline-scenario-form motion-slide-up"><div className="eval-form-card-head"><h4>{editingScenario._id ? 'Edit scenario' : 'New scenario'}</h4><button className="eval-icon-btn" onClick={() => { setEditingScenario(null); setActivePanel('list'); }} title="Close"><FiX /></button></div><div className="eval-form-row"><label>Scenario name</label><input className="eval-input" value={editingScenario.name} onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })} /></div><div className="eval-form-row"><label>Objective</label><textarea className="eval-textarea" rows={2} value={editingScenario.objective} onChange={(e) => setEditingScenario({ ...editingScenario, objective: e.target.value })} /></div><ToolChips label="Required tools" field="requiredToolCalls" /><ToolChips label="Forbidden tools" field="forbiddenToolCalls" /><div className="eval-form-row"><label>Max tool calls</label><input type="number" min="0" className="eval-input" value={editingScenario.maxToolCalls ?? ''} onChange={(e) => setEditingScenario({ ...editingScenario, maxToolCalls: e.target.value === '' ? null : Number(e.target.value) })} /></div><div className="eval-form-card-actions"><button className="eval-cancel" onClick={() => { setEditingScenario(null); setActivePanel('list'); }}>Cancel</button><button className="eval-save" onClick={saveScenario}><FiCheck /> Save scenario</button></div></div>}
                                    <div className="eval-section"><div className="eval-section-head"><span>Run transcript</span></div><textarea className="eval-transcript" rows={5} value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder='{"agentName":"bot","toolCalls":[]}' /><button type="button" className="eval-run-btn" onClick={runSuite} disabled={running}>{running ? 'Scoring…' : <><FiPlay /> Run suite</>}</button>{runError && <p className="hint error eval-run-feedback">{runError}</p>}{lastRun && activePanel === 'run' && <div className="eval-run-result motion-slide-up"><RunResult run={lastRun} /></div>}</div>
                                </li>
                            )}
                        </React.Fragment>
                    ))}
                </ul>

                {creatingSuite && (
                    <div className="eval-modal-overlay" onClick={() => setCreatingSuite(false)}>
                        <div className="eval-modal" onClick={(e) => e.stopPropagation()}>
                            <h4>New suite</h4>
                            <div className="eval-form-row"><label>Suite name</label><input className="eval-input" value={suiteForm.name} onChange={(e) => setSuiteForm({ ...suiteForm, name: e.target.value })} /></div>
                            <div className="eval-form-row"><label>Description</label><textarea className="eval-textarea" rows={2} value={suiteForm.description} onChange={(e) => setSuiteForm({ ...suiteForm, description: e.target.value })} /></div>
                            <div className="eval-form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <input id="suite-create-enabled" type="checkbox" checked={suiteForm.enabled} onChange={(e) => setSuiteForm({ ...suiteForm, enabled: e.target.checked })} />
                                <label htmlFor="suite-create-enabled" style={{ margin: 0 }}>Enabled</label>
                            </div>
                            <div className="eval-modal-actions">
                                <button className="eval-cancel" onClick={() => setCreatingSuite(false)}>Cancel</button>
                                <button className="eval-save" onClick={createSuite}>Create suite</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Suite detail: two-pane layout
    return (
        <div className="eval-panel eval-detail">
            {/* LEFT PANE */}
            <div className="eval-left-pane">
                <div className="eval-detail-header">
                    <button className="eval-back" onClick={() => { setSelectedSuiteId(null); setSelectedSuite(null); setActivePanel('list'); }}><FiArrowLeft /> Back to suites</button>
                    {!editingSuite ? (
                        <div className="eval-detail-title">
                            <div>
                                <h4>{selectedSuite.name}</h4>
                                {selectedSuite.description && <p className="hint">{selectedSuite.description}</p>}
                                <span className="hint">{selectedSuite.enabled ? 'enabled' : 'disabled'} · {selectedSuite.scenarios?.length || 0} scenarios</span>
                            </div>
                            <button className="eval-icon-btn" onClick={() => setEditingSuite(true)}><FiEdit2 /> Edit suite</button>
                        </div>
                    ) : (
                        <div className="eval-suite-edit">
                            <div className="eval-form-row"><label>Suite name</label><input className="eval-input" value={suiteForm.name} onChange={(e) => setSuiteForm({ ...suiteForm, name: e.target.value })} /></div>
                            <div className="eval-form-row"><label>Description</label><textarea className="eval-textarea" rows={2} value={suiteForm.description} onChange={(e) => setSuiteForm({ ...suiteForm, description: e.target.value })} /></div>
                            <div className="eval-form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <input id="suite-enabled" type="checkbox" checked={suiteForm.enabled} onChange={(e) => setSuiteForm({ ...suiteForm, enabled: e.target.checked })} />
                                <label htmlFor="suite-enabled" style={{ margin: 0 }}>Enabled</label>
                            </div>
                            <div className="eval-modal-actions" style={{ marginTop: 10 }}>
                                <button className="eval-cancel" onClick={() => { setSuiteForm({ name: selectedSuite.name, description: selectedSuite.description, enabled: selectedSuite.enabled }); setEditingSuite(false); }}><FiX /> Cancel</button>
                                <button className="eval-save" onClick={saveSuiteForm}><FiSave /> Save suite</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="eval-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <div className="eval-section-head">
                        <span>Scenarios</span>
                        <button className="eval-add-btn small" onClick={startNewScenario}><FiPlus /> Add scenario</button>
                    </div>
                    {(selectedSuite.scenarios || []).length === 0 && <p className="hint">No scenarios yet.</p>}
                    <ol className="eval-scenarios">
                        {(selectedSuite.scenarios || []).map((sc) => (
                            <li key={sc.id} className={`${activePanel === 'scenario-form' && editingScenario?._id === sc.id ? 'active' : ''}`}>
                                <div className="eval-sc-head">
                                    <div>
                                        <strong>{sc.name}</strong>
                                        {sc.objective && <p className="hint" style={{ margin: '2px 0 0' }}>{sc.objective}</p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="eval-icon-btn" onClick={() => editScenario(sc)}><FiEdit2 /> Edit</button>
                                        <button className="eval-icon-btn" onClick={() => deleteScenario(sc.id)} title="Delete"><FiTrash2 /></button>
                                    </div>
                                </div>
                                <div className="eval-sc-tags">
                                    {sc.requiredToolCalls?.map((t) => <span key={`r${t}`} className="tag required">req: {t}</span>)}
                                    {sc.forbiddenToolCalls?.map((t) => <span key={`f${t}`} className="tag forbidden">forbid: {t}</span>)}
                                    {sc.maxToolCalls != null && <span className="tag max">max: {sc.maxToolCalls}</span>}
                                    {sc.argumentAssertions?.map((a, i) => <span key={`a${i}`} className="tag assert">{a.toolName}.{a.path} {a.operator} {a.expected}</span>)}
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="eval-section">
                    <div className="eval-section-head"><span>Run transcript</span></div>
                    <p className="hint">Paste an agent tool-call transcript ({'{ agentName?, toolCalls: [{ toolName, arguments, timestamp? }] }'}). Sensitive argument values are redacted before storage.</p>
                    <textarea className="eval-transcript" rows={8} value={transcriptText}
                        onChange={(e) => setTranscriptText(e.target.value)}
                        placeholder='{"agentName":"bot","toolCalls":[{"toolName":"get_user","arguments":{"id":"1"}}]}' />
                    <button className="eval-run-btn" onClick={runSuite} disabled={running}>
                        {running ? 'Scoring…' : <><FiPlay /> Run suite</>}
                    </button>
                </div>

                {history.length > 0 && (
                    <div className="eval-section">
                        <div className="eval-section-head"><span>Run history</span></div>
                        <ul className="eval-history">
                            {history.map((r) => (
                                <li key={r.id} className={`eval-hist-row ${r.status} ${lastRun?.id === r.id ? 'selected' : ''}`}>
                                    <span className="status-dot">{r.status === 'passed' ? <FiCheckCircle /> : <FiXCircle />}</span>
                                    <strong>{r.score}</strong>
                                    <span className="hint">{r.agentName || 'anonymous'} · {new Date(r.createdAt).toLocaleString()}</span>
                                    <button className="eval-icon-btn" onClick={() => { setLastRun(r); setActivePanel('run'); }}>View</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* RIGHT PANE */}
            <div className="eval-right-pane">
                {activePanel === 'list' && (
                    <div className="eval-empty-state">
                        <FiTarget size={40} />
                        <p className="hint">Select “Add scenario” or “Run suite” to start.</p>
                    </div>
                )}

                {activePanel === 'scenario-form' && editingScenario && (
                    <div className="eval-form-card">
                        <div className="eval-form-card-head">
                            <h4>{editingScenario._id ? 'Edit scenario' : 'New scenario'}</h4>
                            <button className="eval-icon-btn" onClick={() => { setEditingScenario(null); setActivePanel('list'); }}><FiX /></button>
                        </div>

                        <div className="eval-form-row"><label>Scenario name</label><input className="eval-input" value={editingScenario.name} onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })} /></div>
                        <div className="eval-form-row"><label>Objective</label><textarea className="eval-textarea" rows={2} value={editingScenario.objective} onChange={(e) => setEditingScenario({ ...editingScenario, objective: e.target.value })} /></div>

                        <ToolChips label="Required tools" field="requiredToolCalls" />
                        <ToolChips label="Forbidden tools" field="forbiddenToolCalls" />

                        <div className="eval-form-row"><label>Max tool calls (blank = unlimited)</label>
                            <input type="number" min="0" className="eval-input" value={editingScenario.maxToolCalls ?? ''}
                                onChange={(e) => setEditingScenario({ ...editingScenario, maxToolCalls: e.target.value === '' ? null : Number(e.target.value) })} />
                        </div>

                        <div className="eval-field">
                            <label>Argument assertions</label>
                            {(editingScenario.argumentAssertions || []).map((a, i) => (
                                <div key={i} className="eval-assertion-row">
                                    <select className="eval-select" value={a.toolName} onChange={(e) => updateAssertion(i, { toolName: e.target.value })}>
                                        {toolNames.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input className="eval-input" placeholder="argument path (e.g. email)" value={a.path}
                                        onChange={(e) => updateAssertion(i, { path: e.target.value })} />
                                    <select className="eval-select" value={a.operator} onChange={(e) => updateAssertion(i, { operator: e.target.value })}>
                                        {ASSERTION_OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    {a.operator !== 'exists' && a.operator !== 'notExists' && (
                                        <input className="eval-input" placeholder="expected value" value={a.expected}
                                            onChange={(e) => updateAssertion(i, { expected: e.target.value })} />
                                    )}
                                    <button className="eval-icon-btn" onClick={() => removeAssertion(i)}><FiTrash2 /></button>
                                </div>
                            ))}
                            <button className="eval-add-btn small" onClick={addAssertion}><FiPlus /> Add assertion</button>
                        </div>

                        <div className="eval-form-card-actions">
                            <button className="eval-cancel" onClick={() => { setEditingScenario(null); setActivePanel('list'); }}>Cancel</button>
                            <button className="eval-save" onClick={saveScenario}><FiCheck /> Save scenario</button>
                        </div>
                    </div>
                )}

                {activePanel === 'run' && lastRun && (
                    <div className="eval-form-card">
                        <div className="eval-form-card-head">
                            <h4>Latest result</h4>
                            <button className="eval-icon-btn" onClick={() => setActivePanel('list')}><FiX /></button>
                        </div>
                        <RunResult run={lastRun} />
                    </div>
                )}
            </div>
        </div>
    );
};

const RunResult = ({ run }) => {
    const summary = summarizeRunResult(run);
    return (
        <div>
            <div className="eval-section-head">
                <span>Result</span>
                <span className={`status-badge ${summary.status}`}>
                    {summary.status === 'passed' ? <FiCheckCircle /> : <FiXCircle />} {summary.status} · {summary.score}
                </span>
            </div>
            {run.error && <p className="hint error">{run.error}</p>}
            {summary.violations.length > 0 ? (
                <ul className="eval-violations">
                    {summary.violations.map((v, i) => (
                        <li key={i} className="violation">
                            <FiXCircle /> <strong>{v.kind}</strong>{v.toolName ? ` · ${v.toolName}` : ''} — {v.message}
                        </li>
                    ))}
                </ul>
            ) : <p className="hint">No violations.</p>}
            {summary.scenarioRows.length > 0 && (
                <ul className="eval-scenario-results">
                    {summary.scenarioRows.map((sr, i) => (
                        <li key={i} className={sr.status}>
                            <span className="status-dot">{sr.status === 'passed' ? <FiCheckCircle /> : <FiXCircle />}</span>
                            <strong>{sr.name}</strong> <span className="hint">{sr.score}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default EvaluationSuitePanel;
