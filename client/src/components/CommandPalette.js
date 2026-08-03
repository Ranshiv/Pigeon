import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FiActivity, FiBarChart2, FiBookOpen, FiCheckSquare,
    FiClock, FiCode, FiFileText, FiGrid, FiLink, FiMonitor,
    FiCpu, FiRadio, FiSearch, FiSend, FiSettings, FiShield, FiUsers, FiX
} from 'react-icons/fi';
import './CommandPalette.css';

const CommandPalette = ({ isAuthenticated }) => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    const commands = useMemo(() => [
        { label: 'New Request', hint: 'Send an API request', path: '/workspace/api-network/requests/new', icon: FiSend },
        { label: 'API Network', hint: 'Build and explore API requests', path: '/workspace/api-network', icon: FiMonitor },
        { label: 'Workspaces', hint: 'Manage workspaces and teams', path: '/workspace/workspaces', icon: FiGrid },
        { label: 'GraphQL', hint: 'Open the GraphQL tester', path: '/workspace/graphql', icon: FiCode },
        { label: 'Protocol Testing', hint: 'Test WebSocket, gRPC, SOAP, MQTT, and SSE', path: '/workspace/protocols', icon: FiLink },
        { label: 'Monitoring', hint: 'View monitors and health', path: '/workspace/monitoring', icon: FiActivity },
        { label: 'Alerts', hint: 'Review active alerts', path: '/workspace/monitoring/alerts', icon: FiShield },
        { label: 'Incidents', hint: 'Manage operational incidents', path: '/workspace/monitoring/incidents', icon: FiActivity },
        { label: 'Performance Testing', hint: 'Measure APIs under load', path: '/workspace/performance-tests', icon: FiBarChart2 },
        { label: 'Consumer Contracts', hint: 'Run contract tests', path: '/workspace/consumer-contracts', icon: FiCheckSquare },
        { label: 'AI Test Generator', hint: 'Generate reviewable tests from specs and traffic', path: '/workspace/test-generator', icon: FiCpu },
        { label: 'AsyncAPI', hint: 'Design event-driven APIs', path: '/workspace/asyncapi', icon: FiRadio },
        { label: 'Trace to Test', hint: 'Generate tests from traces', path: '/workspace/trace-to-test', icon: FiActivity },
        { label: 'Documentation', hint: 'Read Pigeon feature guides', path: '/documentation', icon: FiBookOpen },
        { label: 'Request History', hint: 'Review recent API runs', path: '/workspace/history', icon: FiClock },
        { label: 'Governance', hint: 'Review API quality signals', path: '/workspace/governance', icon: FiShield },
        { label: 'Compliance', hint: 'Manage policies and audit activity', path: '/workspace/compliance', icon: FiFileText },
        { label: 'Settings', hint: 'Manage your account', path: '/workspace/settings', icon: FiSettings },
        { label: 'Privacy Policy', hint: 'Read Pigeon privacy terms', path: '/privacy', icon: FiShield },
        { label: 'Terms of Service', hint: 'Read the service terms', path: '/terms', icon: FiFileText },
        { label: 'GitHub', hint: 'View source code and contribute', external: 'https://github.com/Ranshiv/Pigeon', icon: FiUsers }
    ], []);

    const filteredCommands = commands.filter(command => `${command.label} ${command.hint}`.toLowerCase().includes(query.trim().toLowerCase()));

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        const handleKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsOpen(true);
                setQuery('');
                setActiveIndex(0);
            } else if (isOpen && event.key === 'Escape') {
                event.preventDefault();
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAuthenticated, isOpen]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        setActiveIndex(index => Math.min(index, Math.max(filteredCommands.length - 1, 0)));
    }, [query, filteredCommands.length]);

    if (!isAuthenticated || !isOpen) return null;

    const close = () => {
        setIsOpen(false);
        setQuery('');
    };

    const execute = (command) => {
        if (!command) return;
        close();
        if (command.external) window.open(command.external, '_blank', 'noopener,noreferrer');
        else navigate(command.path);
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(index => filteredCommands.length ? (index + 1) % filteredCommands.length : 0);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(index => filteredCommands.length ? (index - 1 + filteredCommands.length) % filteredCommands.length : 0);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            execute(filteredCommands[activeIndex]);
        }
    };

    return (
        <div className="pgh-command-overlay" role="presentation" onMouseDown={close}>
            <section className="pgh-command-palette" role="dialog" aria-modal="true" aria-labelledby="pgh-command-title" onMouseDown={event => event.stopPropagation()}>
                <div className="pgh-command-header">
                    <div><span className="pgh-command-eyebrow">Quick navigation</span><h2 id="pgh-command-title">Command palette</h2></div>
                    <button className="pgh-command-close" type="button" aria-label="Close command palette" onClick={close}><FiX /></button>
                </div>
                <div className="pgh-command-search">
                    <FiSearch aria-hidden="true" />
                    <input ref={inputRef} value={query} onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={handleInputKeyDown} placeholder="Search commands..." aria-label="Search commands" autoComplete="off" />
                    <kbd>ESC</kbd>
                </div>
                <div className="pgh-command-list" role="listbox" aria-label="Available commands">
                    {filteredCommands.length > 0 ? filteredCommands.map((command, index) => {
                        const Icon = command.icon;
                        return <button type="button" role="option" aria-selected={index === activeIndex} className={`pgh-command-item${index === activeIndex ? ' is-active' : ''}`} key={command.label} onMouseEnter={() => setActiveIndex(index)} onClick={() => execute(command)}><span className="pgh-command-icon"><Icon aria-hidden="true" /></span><span className="pgh-command-copy"><strong>{command.label}</strong><small>{command.hint}</small></span>{index === activeIndex && <span className="pgh-command-enter">↵</span>}</button>;
                    }) : <div className="pgh-command-empty">No commands match “{query}”.</div>}
                </div>
                <footer className="pgh-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></footer>
            </section>
        </div>
    );
};

export default CommandPalette;
