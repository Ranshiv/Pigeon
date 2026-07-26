import React, { useMemo, useState } from 'react';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiClock, FiPlay, FiShield, FiTarget } from 'react-icons/fi';
import AppSelect from './common/AppSelect/AppSelect';
import { extractVariables, interpolateRequest, resolveVariables } from '../utils/variableInterpolation';
import './FuzzTestingPanel.css';

const clone = (value) => JSON.parse(JSON.stringify(value));

const typeOf = (value) => Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

const hasJsonObjectBody = (body) => {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

const buildCases = (request) => {
  let source;
  try {
    source = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body;
  } catch {
    return [];
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  const entries = Object.entries(source);
  const cases = [{ name: 'Baseline', mutation: 'Original request body', body: source, kind: 'baseline' }];

  entries.forEach(([key, value]) => {
    const omitted = clone(source);
    delete omitted[key];
    cases.push({ name: `Missing ${key}`, mutation: `Removed ${key}`, body: omitted, kind: 'edge' });

    const wrongType = clone(source);
    const currentType = typeOf(value);
    wrongType[key] = currentType === 'string' ? 42 : currentType === 'number' ? 'not-a-number' : currentType === 'boolean' ? 'not-a-boolean' : 'invalid-value';
    cases.push({ name: `Wrong type: ${key}`, mutation: `${currentType} → ${typeOf(wrongType[key])}`, body: wrongType, kind: 'invalid' });

    if (typeof value === 'string') {
      const empty = clone(source);
      empty[key] = '';
      cases.push({ name: `Empty ${key}`, mutation: 'Replaced with empty string', body: empty, kind: 'edge' });
      const long = clone(source);
      long[key] = 'x'.repeat(512);
      cases.push({ name: `Long ${key}`, mutation: '512-character string', body: long, kind: 'boundary' });
    }
    if (typeof value === 'number') {
      const negative = clone(source);
      negative[key] = -1;
      cases.push({ name: `Negative ${key}`, mutation: 'Replaced with -1', body: negative, kind: 'boundary' });
    }
  });

  const extra = clone(source);
  extra.__pigeonFuzzProbe = 'unexpected-property';
  cases.push({ name: 'Unexpected property', mutation: 'Added __pigeonFuzzProbe', body: extra, kind: 'invalid' });
  return cases;
};

const statusLabel = (result) => {
  if (result.error) return 'Error';
  if (result.status >= 500) return 'Server error';
  if (result.status >= 400) return 'Rejected';
  return 'Accepted';
};

export default function FuzzTestingPanel({ requests, collectionId, workspaceId, selectedEnvironment, collectionVariables }) {
  const compatibleRequests = useMemo(() => requests.filter((request) => (
    hasJsonObjectBody(request.body)
    && !['GET', 'HEAD'].includes(String(request.method || '').toUpperCase())
  )), [requests]);
  const [requestId, setRequestId] = useState('');
  const activeRequest = compatibleRequests.find((request) => String(request._id || request.id) === requestId) || compatibleRequests[0];
  const cases = useMemo(() => activeRequest ? buildCases(activeRequest) : [], [activeRequest]);
  const executableRequest = useMemo(() => {
    if (!activeRequest) return null;
    const resolvedVariables = resolveVariables(
      activeRequest.variables,
      selectedEnvironment?.variables,
      collectionVariables
    );
    const interpolated = interpolateRequest(activeRequest, resolvedVariables);
    const parameters = interpolated.params || [];
    const url = String(interpolated.url || '').replace(/(^|\/):([A-Za-z_][A-Za-z0-9_]*)/g, (match, prefix, key) => {
      const parameter = parameters.find((item) => (item.key || item.name) === key && item.enabled !== false && item.value !== undefined && item.value !== '');
      return parameter ? `${prefix}${encodeURIComponent(parameter.value)}` : match;
    });
    return { ...interpolated, url };
  }, [activeRequest, selectedEnvironment, collectionVariables]);
  const unresolvedValues = useMemo(() => {
    if (!executableRequest?.url) return [];
    const templateValues = extractVariables(executableRequest.url);
    const pathValues = [...String(executableRequest.url).matchAll(/(?:^|\/):([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
    return [...new Set([...templateValues, ...pathValues])];
  }, [executableRequest]);
  const [limit, setLimit] = useState(8);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const serverErrorCount = results.filter((result) => result.error || result.status >= 500).length;

  const runFuzzTests = async () => {
    if (!activeRequest || !cases.length || running || unresolvedValues.length) return;
    setRunning(true);
    setResults([]);
    const runCases = cases.slice(0, Number(limit));
    const completed = [];
    for (const testCase of runCases) {
      const started = performance.now();
      try {
        const response = await fetch(`/api/requests/${activeRequest._id || activeRequest.id}/send`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          ...executableRequest,
            collectionId,
            workspaceId,
            requestId: activeRequest._id || activeRequest.id,
            body: JSON.stringify(testCase.body),
            bodyType: 'json'
          })
        });
        const payload = await response.json().catch(() => ({}));
        completed.push({ ...testCase, status: payload.status || response.status, duration: payload.duration ?? Math.round(performance.now() - started), error: !response.ok ? payload.error || payload.message || 'Request failed' : '' });
      } catch (error) {
        completed.push({ ...testCase, status: 0, duration: Math.round(performance.now() - started), error: error.message || 'Network request failed' });
      }
      setResults([...completed]);
    }
    setRunning(false);
  };

  if (!compatibleRequests.length) return (
    <section className="fuzz-panel fuzz-empty">
      <FiTarget aria-hidden="true" />
      <div><span className="fuzz-eyebrow">Schema-driven testing</span><h2>Add a JSON request to begin fuzzing</h2><p>Fuzz testing supports POST, PUT, PATCH, and DELETE requests with a saved JSON object body. Choose Raw and enter valid JSON in the request form; it learns fields, then probes missing values, wrong types and boundaries without changing the saved request.</p></div>
    </section>
  );

  const hasConfigurationIssue = unresolvedValues.length > 0;

  return (
    <section className="fuzz-panel">
      <header className="fuzz-hero">
        <div><span className="fuzz-eyebrow"><FiShield /> Safe request mutations</span><h2>Schema-driven fuzz testing</h2><p>Generate edge cases from your request body and identify APIs that accept unexpected input or fail under invalid data.</p></div>
        <div className="fuzz-summary"><FiActivity /><strong>{cases.length}</strong><span>cases discovered</span></div>
      </header>
      <div className="fuzz-controls">
        <div className="fuzz-field">
          <label htmlFor="fuzz-request">Target request</label>
          <AppSelect
            id="fuzz-request"
            className="fuzz-request-select"
            value={requestId || String(activeRequest._id || activeRequest.id)}
            onChange={(value) => { setRequestId(value); setResults([]); }}
            options={compatibleRequests.map((request) => ({ value: String(request._id || request.id), label: `${request.method} · ${request.name || request.url}` }))}
          />
        </div>
        <div className="fuzz-field fuzz-field--profile">
          <label htmlFor="fuzz-case-limit">Test profile</label>
          <AppSelect
            id="fuzz-case-limit"
            value={limit}
            onChange={setLimit}
            options={[{ value: 5, label: 'Quick · 5 cases' }, { value: 8, label: 'Standard · 8 cases' }, { value: 15, label: 'Full · all cases' }]}
          />
        </div>
        <div className="fuzz-run-action">
          <span>Generated from {Object.keys(cases[0]?.body || {}).length} detected field{Object.keys(cases[0]?.body || {}).length === 1 ? '' : 's'}</span>
          <button type="button" className="fuzz-run-button" onClick={runFuzzTests} disabled={running || !cases.length || hasConfigurationIssue}><FiPlay />{running ? 'Running…' : 'Run fuzz tests'}</button>
        </div>
      </div>
      {hasConfigurationIssue && <div className="fuzz-configuration-warning"><FiAlertTriangle /><div><b>Configure this request before fuzzing.</b><span>Set values for {unresolvedValues.map((value) => executableRequest.url.includes(`{{${value}}}`) ? `{{${value}}}` : `:${value}`).join(', ')} in the selected environment or request parameters.</span></div></div>}
      <div className="fuzz-workspace">
        <section className="fuzz-results-pane">
          <div className="fuzz-pane-heading"><div><span className="fuzz-eyebrow">Execution matrix</span><h3>Generated test cases</h3></div><span className={`fuzz-queue ${results.length ? 'complete' : ''}`}>{results.length ? `${results.length} completed` : `${Math.min(cases.length, Number(limit))} queued`}</span></div>
          <div className="fuzz-notice"><FiAlertTriangle /> Generated payloads are sent to the selected endpoint. Use a test environment for requests that change data.</div>
          <div className="fuzz-table-wrap"><table className="fuzz-table"><thead><tr><th>Test case</th><th>Mutation</th><th>Result</th><th>Response time</th></tr></thead><tbody>
            {(results.length ? results : cases.slice(0, Number(limit))).map((testCase, index) => {
              const done = Boolean(results.length); const label = done ? statusLabel(testCase) : 'Ready';
              return <tr key={`${testCase.name}-${index}`}><td><span className={`fuzz-kind ${testCase.kind}`}>{testCase.kind}</span>{testCase.name}</td><td>{testCase.mutation}</td><td><span className={`fuzz-status ${done && testCase.error ? 'failed' : done && testCase.status >= 500 ? 'failed' : done ? 'complete' : 'ready'}`}>{done && !testCase.error && testCase.status < 500 ? <FiCheckCircle /> : done ? <FiAlertTriangle /> : <FiClock />}{label}{done && testCase.status ? ` · ${testCase.status}` : ''}</span></td><td>{done ? `${testCase.duration} ms` : '—'}</td></tr>;
            })}
          </tbody></table></div>
          {results.length > 0 && <p className="fuzz-result-note">A rejected 4xx response is usually expected for invalid input. Review accepted invalid cases and any 5xx errors first.</p>}
        </section>
        <aside className="fuzz-guide">
          <div><span className="fuzz-eyebrow">Run insight</span><h3>{results.length ? 'Review this run' : 'Ready to probe'}</h3><p>{results.length ? 'Prioritize any server errors and invalid payloads your API accepted.' : 'Each payload is derived from the selected request; the original request is never modified.'}</p></div>
          <div className="fuzz-insight-stats"><div><strong>{results.length || Math.min(cases.length, Number(limit))}</strong><span>{results.length ? 'cases run' : 'cases queued'}</span></div><div><strong>{serverErrorCount}</strong><span>server errors</span></div></div>
          <ol className="fuzz-guide-list"><li><b>Baseline</b><span>Confirms the original payload still behaves as expected.</span></li><li><b>Validation</b><span>Removes fields and changes types to verify input handling.</span></li><li><b>Boundaries</b><span>Probes empty, long, and unexpected values for resilience.</span></li></ol>
          <div className="fuzz-guide-footer"><FiShield /> Invalid payloads that receive 4xx responses are normally handled correctly.</div>
        </aside>
      </div>
    </section>
  );
}
