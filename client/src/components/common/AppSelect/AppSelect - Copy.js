// client/src/components/common/AppSelect/AppSelect.js
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

const AppSelect = ({ value, onChange, options, disabled, className = '', id }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const rootRef = useRef(null);
    const triggerRef = useRef(null);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const update = () => {
            const r = triggerRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 4, left: r.left, width: r.width });
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    const current = options.find((o) => o.value === value);

    const list = open && !disabled ? (
        <ul
            className="app-select-list"
            role="listbox"
            style={{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }}
        >
            {options.map((o) => (
                <li
                    key={String(o.value)}
                    role="option"
                    aria-selected={o.value === value}
                    className={`app-select-option${o.value === value ? ' app-select-option--active' : ''}`}
                    onClick={() => { onChange(o.value); setOpen(false); }}
                >
                    {o.label}
                </li>
            ))}
        </ul>
    ) : null;

    return (
        <div className={`app-select ${className}`.trim()} ref={rootRef}>
            <button
                type="button"
                id={id}
                ref={triggerRef}
                className="app-select-trigger"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="app-select-value">{current ? current.label : ''}</span>
                <FiChevronDown className="app-select-chevron" />
            </button>
            {list && createPortal(list, document.body)}
        </div>
    );
};

export default AppSelect;
