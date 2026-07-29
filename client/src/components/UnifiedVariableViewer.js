import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiDatabase, FiEdit2, FiEye, FiEyeOff, FiGlobe, FiInfo, FiLayers, FiPlus, FiSettings, FiX } from 'react-icons/fi';
import './UnifiedVariableViewer.css';

const EMPTY_VARIABLE = { key: '', value: '', description: '', type: 'string' };

const UnifiedVariableViewer = ({
    globalVariables = [], collectionVariables = [], environmentVariables = [], requestVariables = [],
    resolvedVariables = {}, onEditVariable, onAddVariable, editableScope, showActions = false,
    compact = false, defaultScope = 'request', openAddSignal, openAddScope
}) => {
    const levels = useMemo(() => [
        { id: 'request', label: 'Request', name: 'Request variables', icon: FiSettings, variables: Array.isArray(requestVariables) ? requestVariables : [], priority: 1 },
        { id: 'environment', label: 'Environment', name: 'Environment variables', icon: FiLayers, variables: Array.isArray(environmentVariables) ? environmentVariables : [], priority: 2 },
        { id: 'collection', label: 'Collection', name: 'Collection variables', icon: FiDatabase, variables: Array.isArray(collectionVariables) ? collectionVariables : [], priority: 3 },
        { id: 'global', label: 'Global', name: 'Global variables', icon: FiGlobe, variables: Array.isArray(globalVariables) ? globalVariables : [], priority: 4 }
    ], [requestVariables, environmentVariables, collectionVariables, globalVariables]);

    const initialScope = levels.find((level) => level.variables.length)?.id || defaultScope;
    const [activeScope, setActiveScope] = useState(initialScope);
    const [visibleValues, setVisibleValues] = useState({});
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState(EMPTY_VARIABLE);
    const activeLevel = levels.find((level) => level.id === activeScope) || levels[0];
    const canEdit = Boolean(onAddVariable) && (editableScope === 'all' || editableScope === activeLevel.id || (Array.isArray(editableScope) && editableScope.includes(activeLevel.id)));

    useEffect(() => {
        if (!openAddSignal) return;
        setActiveScope(openAddScope || 'request');
        setIsAdding(true);
    }, [openAddSignal, openAddScope]);

    const resetDraft = () => { setDraft(EMPTY_VARIABLE); setIsAdding(false); };
    const addVariable = () => {
        const key = draft.key.trim();
        if (!key || !onAddVariable) return;
        onAddVariable({ ...draft, key }, activeLevel.id);
        resetDraft();
    };
    const isOverridden = (key) => levels.some((level) => level.priority < activeLevel.priority && level.variables.some((item) => item.key === key));

    return (
        <section className={`uvv ${compact ? 'uvv--compact' : ''}`} aria-label="Variable manager">
            {!compact && <header className="uvv__header"><div><h3>Variables</h3><p>Request variables override environment, collection, and global values.</p></div><span className="uvv__total">{levels.reduce((total, level) => total + level.variables.length, 0)} total</span></header>}

            <div className="uvv__tabs" role="tablist" aria-label="Variable scope">
                {levels.map((level) => {
                    const Icon = level.icon;
                    return <button type="button" role="tab" aria-selected={activeScope === level.id} key={level.id} className={`uvv__tab${activeScope === level.id ? ' is-active' : ''}`} onClick={() => { setActiveScope(level.id); resetDraft(); }}><Icon size={14} /><span>{level.label}</span><span className="uvv__count">{level.variables.length}</span></button>;
                })}
            </div>

            <div className="uvv__content">
                {activeLevel.variables.length ? <>
                    <div className="uvv__grid">
                    {activeLevel.variables.map((variable, index) => {
                        const key = `${activeLevel.id}:${variable.key}:${index}`;
                        const visible = Boolean(visibleValues[key]);
                        const overridden = isOverridden(variable.key);
                        const resolved = Object.prototype.hasOwnProperty.call(resolvedVariables, variable.key);
                        return <article className={`uvv__card${overridden ? ' is-overridden' : ''}`} key={key}>
                            <div className="uvv__card-head"><code>{variable.key}</code><div className="uvv__card-actions"><button type="button" className="uvv__icon-button" onClick={() => setVisibleValues((current) => ({ ...current, [key]: !visible }))} aria-label={`${visible ? 'Hide' : 'Show'} ${variable.key}`}>{visible ? <FiEyeOff size={15} /> : <FiEye size={15} />}</button>{showActions && onEditVariable && <button type="button" className="uvv__icon-button" onClick={() => onEditVariable(variable, activeLevel.id)} aria-label={`Edit ${variable.key}`}><FiEdit2 size={14} /></button>}</div></div>
                            <div className="uvv__value"><span>Value</span><code>{visible ? (variable.value || '(empty)') : '••••••••'}</code></div>
                            <footer className="uvv__card-foot">{overridden ? <span className="uvv__badge">Overridden</span> : resolved ? <span className="uvv__badge uvv__badge--active"><FiCheck size={12} /> Active</span> : <span className="uvv__muted">Not resolved</span>}</footer>
                        </article>;
                    })}
                    </div>
                    {canEdit && !isAdding && <button type="button" className="uvv__add-button" onClick={() => setIsAdding(true)}><FiPlus size={15} /><span>Add variable</span></button>}
                </> : <div className="uvv__empty"><span className="uvv__empty-icon"><FiInfo size={18} /></span><div><h4>No {activeLevel.name.toLowerCase()} yet</h4><p>Add a reusable value for this scope.</p></div>{canEdit && !isAdding && <button type="button" className="uvv__primary-button" onClick={() => setIsAdding(true)}><FiPlus size={15} /> Add variable</button>}</div>}

                {canEdit && isAdding && <div className="uvv__form" role="group" aria-label={`Create ${activeLevel.label.toLowerCase()} variable`}><div className="uvv__form-fields"><label>Variable name<input value={draft.key} onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariable(); } }} placeholder="e.g. baseUrl" autoFocus /></label><label>Value<input value={draft.value} onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addVariable(); } }} placeholder="https://api.example.com" /></label></div><div className="uvv__form-actions"><button type="button" className="uvv__primary-button" onClick={addVariable} disabled={!draft.key.trim()}><FiPlus size={15} /> Create variable</button><button type="button" className="uvv__secondary-button" onClick={resetDraft}><FiX size={15} /> Cancel</button></div></div>}
            </div>
        </section>
    );
};

export default UnifiedVariableViewer;
