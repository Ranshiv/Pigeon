import React, { useMemo, useRef, useState } from 'react';
import YAML from 'yaml';
import {
    FiArrowDown,
    FiArrowUp,
    FiCheck,
    FiDownload,
    FiFileText,
    FiPlay,
    FiPlus,
    FiUpload
} from 'react-icons/fi';
import AppSelect from '../../common/AppSelect/AppSelect';
import './ArazzoWorkflowWorkspace.css';

const ARAZZO_VERSION = '1.1.0';

const slugify = (value, fallback) => {
    const slug = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/^-?(\d)/, 'step-$1')
        .toLowerCase();

    return slug || fallback;
};

const requestPath = (url = '') => {
    try {
        return new URL(url).pathname || '/';
    } catch {
        const pathname = String(url).split('?')[0];
        return pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
    }
};

const escapeJsonPointer = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');

const createStep = (request, index) => {
    const method = String(request?.method || 'GET').toLowerCase();
    const path = requestPath(request?.url);
    const label = request?.name || `${method.toUpperCase()} ${path}`;

    return {
        stepId: `${slugify(label, 'request')}-${index + 1}`,
        description: label,
        operationPath: `$sourceDescriptions.pigeonApi.url#/paths/${escapeJsonPointer(path)}/${method}`,
        'x-pigeon-request-id': String(request?._id || request?.id || index)
    };
};

export const createArazzoWorkflow = (requests = [], collectionName = 'Pigeon API') => ({
    arazzo: ARAZZO_VERSION,
    info: {
        title: `${collectionName} workflow`,
        version: '1.0.0',
        description: 'A reusable API workflow generated from this Pigeon collection.'
    },
    sourceDescriptions: [{
        name: 'pigeonApi',
        url: './openapi.yaml',
        type: 'openapi'
    }],
    workflows: [{
        workflowId: 'primary-workflow',
        summary: `Primary ${collectionName} workflow`,
        description: 'Run the collection requests in sequence.',
        steps: requests.map(createStep)
    }]
});

const download = (contents, filename) => {
    const blob = new Blob([contents], { type: 'application/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const interpolateString = (value, variables) => {
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        if (!Object.prototype.hasOwnProperty.call(variables, key)) return match;
        const replacement = variables[key];
        return typeof replacement === 'object' ? JSON.stringify(replacement) : String(replacement);
    });
};

const interpolateRequestData = (value, variables) => {
    if (typeof value === 'string') return interpolateString(value, variables);
    if (Array.isArray(value)) return value.map((item) => interpolateRequestData(item, variables));
    if (!value || typeof value !== 'object') return value;
    return Object.entries(value).reduce((result, [key, item]) => ({
        ...result,
        [key]: interpolateRequestData(item, variables)
    }), {});
};

const getResponseValue = (body, responsePath) => {
    const path = String(responsePath || '$').trim();
    if (path === '$') return body;
    if (!path.startsWith('$')) return undefined;

    const tokens = path.slice(1).match(/[^.[\]]+|\[(?:\d+|['"][^'"]+['"])\]/g) || [];
    return tokens.reduce((value, token) => {
        if (value === undefined || value === null) return undefined;
        const key = token.startsWith('[')
            ? token.slice(1, -1).replace(/^['"]|['"]$/g, '')
            : token.replace(/^\./, '');
        return value[key];
    }, body);
};

const toVariableMap = (variables = []) => variables.reduce((result, variable) => {
    if (variable?.enabled !== false && variable?.key) result[variable.key] = variable.value;
    return result;
}, {});

const ArazzoWorkflowWorkspace = ({
    collectionName,
    collectionId,
    requests = [],
    collectionVariables = [],
    workflow,
    onWorkflowChange,
    onSave
}) => {
    const fileInputRef = useRef(null);
    const [selectedRequest, setSelectedRequest] = useState('');
    const [importError, setImportError] = useState('');
    const [saveState, setSaveState] = useState('idle');
    const [runState, setRunState] = useState({ status: 'idle', results: [] });
    const [stopOnFailure, setStopOnFailure] = useState(true);

    const generatedWorkflow = useMemo(
        () => createArazzoWorkflow(requests, collectionName),
        [requests, collectionName]
    );
    const activeWorkflow = workflow || generatedWorkflow;
    const activeWorkflowDefinition = activeWorkflow.workflows?.[0] || generatedWorkflow.workflows[0];
    const workflowSteps = activeWorkflowDefinition.steps || [];
    const yamlPreview = useMemo(() => YAML.stringify(activeWorkflow), [activeWorkflow]);

    const updateWorkflow = (updater) => {
        const nextWorkflow = typeof updater === 'function' ? updater(activeWorkflow) : updater;
        onWorkflowChange?.(nextWorkflow);
    };

    const updateMetadata = (field, value) => {
        updateWorkflow((current) => ({
            ...current,
            info: { ...current.info, [field]: value }
        }));
    };

    const updateWorkflowDefinition = (field, value) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, index) => index === 0 ? { ...item, [field]: value } : item)
        }));
    };

    const updateStep = (index, field, value) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => {
                if (workflowIndex !== 0) return item;
                return {
                    ...item,
                    steps: item.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step)
                };
            })
        }));
    };

    const updateCapture = (stepIndex, captureIndex, field, value) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => {
                if (workflowIndex !== 0) return item;
                const steps = item.steps.map((step, index) => {
                    if (index !== stepIndex) return step;
                    const captures = [...(step['x-pigeon-capture'] || [])];
                    captures[captureIndex] = { ...captures[captureIndex], [field]: value };
                    return { ...step, 'x-pigeon-capture': captures };
                });
                return { ...item, steps };
            })
        }));
    };

    const addCapture = (stepIndex) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => workflowIndex === 0 ? {
                ...item,
                steps: item.steps.map((step, index) => index === stepIndex ? {
                    ...step,
                    'x-pigeon-capture': [...(step['x-pigeon-capture'] || []), { variable: '', responsePath: '$.id' }]
                } : step)
            } : item)
        }));
    };

    const removeCapture = (stepIndex, captureIndex) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => workflowIndex === 0 ? {
                ...item,
                steps: item.steps.map((step, index) => index === stepIndex ? {
                    ...step,
                    'x-pigeon-capture': (step['x-pigeon-capture'] || []).filter((_, itemIndex) => itemIndex !== captureIndex)
                } : step)
            } : item)
        }));
    };

    const moveStep = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= workflowSteps.length) return;

        updateWorkflow((current) => {
            const steps = [...current.workflows[0].steps];
            [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
            return {
                ...current,
                workflows: current.workflows.map((item, workflowIndex) => workflowIndex === 0 ? { ...item, steps } : item)
            };
        });
    };

    const removeStep = (index) => {
        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => workflowIndex === 0
                ? { ...item, steps: item.steps.filter((_, stepIndex) => stepIndex !== index) }
                : item)
        }));
    };

    const addStep = () => {
        const request = requests.find((item, index) => String(item._id || item.id || index) === selectedRequest);
        if (!request) return;

        updateWorkflow((current) => ({
            ...current,
            workflows: current.workflows.map((item, workflowIndex) => workflowIndex === 0
                ? { ...item, steps: [...item.steps, createStep(request, item.steps.length)] }
                : item)
        }));
        setSelectedRequest('');
    };

    const handleImport = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const parsed = YAML.parse(await file.text());
            if (!parsed?.arazzo || !Array.isArray(parsed.workflows) || parsed.workflows.length === 0) {
                throw new Error('The file must contain an Arazzo version and at least one workflow.');
            }
            setImportError('');
            updateWorkflow(parsed);
        } catch (error) {
            setImportError(error.message || 'Unable to read that Arazzo document.');
        }
    };

    const saveWorkflow = async () => {
        if (!onSave) return;
        setSaveState('saving');
        const result = await onSave(activeWorkflow);
        setSaveState(result?.success === false ? 'error' : 'saved');
    };

    const getRequestForStep = (step) => {
        const savedRequestId = step['x-pigeon-request-id'];
        if (savedRequestId) {
            const request = requests.find((item, index) => String(item._id || item.id || index) === String(savedRequestId));
            if (request) return request;
        }

        return requests.find((item) => createStep(item, 0).operationPath === step.operationPath);
    };

    const runWorkflow = async () => {
        const steps = activeWorkflowDefinition.steps || [];
        if (!steps.length || runState.status === 'running') return;

        const initialResults = steps.map((step) => ({ stepId: step.stepId, status: 'pending' }));
        setRunState({ status: 'running', results: initialResults });
        const results = [...initialResults];
        const workflowVariables = toVariableMap(collectionVariables);

        for (let index = 0; index < steps.length; index += 1) {
            const step = steps[index];
            const request = getRequestForStep(step);
            let result;

            if (!request) {
                result = { stepId: step.stepId, status: 'failed', message: 'No collection request matches this Arazzo step.' };
            } else {
                try {
                    const requestId = String(request._id || request.id || index);
                    const requestData = interpolateRequestData(request, workflowVariables);
                    const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ ...requestData, collectionId, requestId })
                    });
                    const payload = await response.json().catch(() => ({}));
                    const failedTests = Array.isArray(payload.testResults) && payload.testResults.some((test) => test.passed === false);
                    const passed = response.ok && payload.status >= 200 && payload.status < 400 && !failedTests;

                    const captures = step['x-pigeon-capture'] || [];
                    const capturedVariables = [];
                    let captureError = '';
                    for (const capture of captures) {
                        const variable = String(capture.variable || '').trim();
                        if (!variable) continue;
                        const value = getResponseValue(payload.body, capture.responsePath);
                        if (value === undefined) {
                            captureError = `Could not capture “${variable}” from ${capture.responsePath || '$'}.`;
                            break;
                        }
                        workflowVariables[variable] = value;
                        capturedVariables.push(variable);
                    }

                    result = {
                        stepId: step.stepId,
                        status: passed && !captureError ? 'passed' : 'failed',
                        httpStatus: payload.status,
                        duration: payload.duration,
                        message: captureError || (passed ? '' : payload.message || payload.error || payload.statusText || 'Request failed'),
                        capturedVariables
                    };
                } catch (error) {
                    result = { stepId: step.stepId, status: 'failed', message: error.message || 'Unable to execute request.' };
                }
            }

            results[index] = result;
            setRunState({ status: 'running', results: [...results] });

            if (result.status === 'failed' && stopOnFailure) {
                for (let skippedIndex = index + 1; skippedIndex < results.length; skippedIndex += 1) {
                    results[skippedIndex] = {
                        stepId: steps[skippedIndex].stepId,
                        status: 'skipped',
                        message: 'Skipped because an earlier step failed.'
                    };
                }
                break;
            }
        }

        setRunState({ status: 'complete', results });
    };

    return (
        <section className="arazzo-workspace" aria-label="Arazzo workflow designer">
            <header className="arazzo-header">
                <div>
                    <span className="arazzo-eyebrow">Arazzo {ARAZZO_VERSION}</span>
                    <h2>API workflow</h2>
                    <p>Compose a repeatable sequence of API calls and export it as a portable Arazzo document.</p>
                </div>
                <div className="arazzo-header-actions">
                    <button className="arazzo-button arazzo-button-primary" type="button" onClick={runWorkflow} disabled={runState.status === 'running' || workflowSteps.length === 0}>
                        <FiPlay /> {runState.status === 'running' ? 'Running…' : 'Run workflow'}
                    </button>
                    <button className="arazzo-button" type="button" onClick={() => fileInputRef.current?.click()}>
                        <FiUpload /> Import
                    </button>
                    <button className="arazzo-button" type="button" onClick={() => download(yamlPreview, 'arazzo.yaml')}>
                        <FiDownload /> Export YAML
                    </button>
                    <button className="arazzo-button arazzo-button-primary" type="button" onClick={saveWorkflow} disabled={saveState === 'saving'}>
                        <FiCheck /> {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save workflow'}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".yaml,.yml,.json" hidden onChange={handleImport} />
                </div>
            </header>

            {importError && <p className="arazzo-error" role="alert">{importError}</p>}

            <div className="arazzo-metadata-grid">
                <label>Title<input value={activeWorkflow.info?.title || ''} onChange={(event) => updateMetadata('title', event.target.value)} /></label>
                <label>Version<input value={activeWorkflow.info?.version || ''} onChange={(event) => updateMetadata('version', event.target.value)} /></label>
                <label className="arazzo-full-width">Description<textarea rows="2" value={activeWorkflow.info?.description || ''} onChange={(event) => updateMetadata('description', event.target.value)} /></label>
            </div>

            <div className="arazzo-workflow-card">
                <div className="arazzo-workflow-heading">
                    <FiFileText aria-hidden="true" />
                    <div>
                        <h3>Workflow definition</h3>
                        <p>Steps run in top-to-bottom order. Their operation paths point to the collection’s OpenAPI export.</p>
                    </div>
                </div>
                <div className="arazzo-metadata-grid">
                    <label>Workflow ID<input value={activeWorkflowDefinition.workflowId || ''} onChange={(event) => updateWorkflowDefinition('workflowId', slugify(event.target.value, 'workflow'))} /></label>
                    <label>Summary<input value={activeWorkflowDefinition.summary || ''} onChange={(event) => updateWorkflowDefinition('summary', event.target.value)} /></label>
                    <label className="arazzo-full-width">Workflow description<textarea rows="2" value={activeWorkflowDefinition.description || ''} onChange={(event) => updateWorkflowDefinition('description', event.target.value)} /></label>
                </div>

                <ol className="arazzo-steps">
                    {workflowSteps.map((step, index) => (
                        <li className="arazzo-step" key={`${step.stepId}-${index}`}>
                            <div className="arazzo-step-index">{index + 1}</div>
                            <div className="arazzo-step-fields">
                                <label>Step ID<input value={step.stepId || ''} onChange={(event) => updateStep(index, 'stepId', slugify(event.target.value, `step-${index + 1}`))} /></label>
                                <label>Description<input value={step.description || ''} onChange={(event) => updateStep(index, 'description', event.target.value)} /></label>
                                <label className="arazzo-full-width">Operation path<input value={step.operationPath || ''} onChange={(event) => updateStep(index, 'operationPath', event.target.value)} /></label>
                                <div className="arazzo-captures arazzo-full-width">
                                    <div className="arazzo-captures-heading">
                                        <span>Response variables</span>
                                        <button type="button" onClick={() => addCapture(index)}><FiPlus /> Capture value</button>
                                    </div>
                                    {(step['x-pigeon-capture'] || []).map((capture, captureIndex) => (
                                        <div className="arazzo-capture-row" key={`${capture.variable}-${captureIndex}`}>
                                            <input value={capture.variable || ''} placeholder="Variable name, e.g. orderId" onChange={(event) => updateCapture(index, captureIndex, 'variable', event.target.value)} />
                                            <input value={capture.responsePath || ''} placeholder="Response path, e.g. $.id" onChange={(event) => updateCapture(index, captureIndex, 'responsePath', event.target.value)} />
                                            <button type="button" className="arazzo-remove" onClick={() => removeCapture(index, captureIndex)}>Remove</button>
                                        </div>
                                    ))}
                                    <p>Capture a JSON response value here, then use it as <code>{'{{variableName}}'}</code> in any later request.</p>
                                </div>
                            </div>
                            <div className="arazzo-step-actions" aria-label={`Actions for step ${index + 1}`}>
                                <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} title="Move step up"><FiArrowUp /></button>
                                <button type="button" onClick={() => moveStep(index, 1)} disabled={index === workflowSteps.length - 1} title="Move step down"><FiArrowDown /></button>
                                <button type="button" className="arazzo-remove" onClick={() => removeStep(index)}>Remove</button>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="arazzo-add-step">
                    <AppSelect
                        className="arazzo-request-select"
                        value={selectedRequest}
                        onChange={setSelectedRequest}
                        placeholder="Choose a collection request…"
                        options={requests.map((request, index) => ({
                            value: String(request._id || request.id || index),
                            label: request.name || `${request.method || 'GET'} ${requestPath(request.url)}`
                        }))}
                    />
                    <button className="arazzo-button" type="button" disabled={!selectedRequest} onClick={addStep}><FiPlus /> Add step</button>
                </div>
            </div>

            <section className="arazzo-run-results" aria-live="polite">
                <div className="arazzo-run-results-header">
                    <div>
                        <h3>Run results</h3>
                        <p>{runState.status === 'idle' ? 'Run the workflow to inspect each request outcome.' : runState.status === 'running' ? 'Running steps in sequence…' : 'Latest workflow execution.'}</p>
                    </div>
                    <label className="arazzo-stop-control">
                        <input type="checkbox" checked={stopOnFailure} onChange={(event) => setStopOnFailure(event.target.checked)} />
                        Stop on failure
                    </label>
                </div>
                {runState.results.length > 0 ? (
                    <ol className="arazzo-result-list">
                        {runState.results.map((result, index) => (
                            <li key={`${result.stepId}-${index}`} className={`arazzo-result arazzo-result--${result.status}`}>
                                <span className="arazzo-result-status">{result.status === 'passed' ? 'Passed' : result.status === 'failed' ? 'Failed' : result.status === 'skipped' ? 'Skipped' : 'Pending'}</span>
                                <strong>{result.stepId}</strong>
                                {result.httpStatus && <span>HTTP {result.httpStatus}</span>}
                                {typeof result.duration === 'number' && <span>{result.duration} ms</span>}
                                {result.message && <span className="arazzo-result-message">{result.message}</span>}
                            </li>
                        ))}
                    </ol>
                ) : <p className="arazzo-run-empty">No runs yet.</p>}
            </section>

            <details className="arazzo-yaml-preview">
                <summary>Preview exported Arazzo YAML</summary>
                <pre>{yamlPreview}</pre>
            </details>
        </section>
    );
};

export default ArazzoWorkflowWorkspace;
