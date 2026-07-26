// client/src/components/asyncapi/AsyncApiModal.js
// Lightweight modal overlay for AsyncAPI create/edit forms. Uses createPortal
// to escape nested container stacking, mirrors the diff-modal-overlay pattern
// seen elsewhere in the codebase. No bottom toasts or alert() popups.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import './asyncapi.css';

const AsyncApiModal = ({ open, title, onClose, children, footer, variant = '', ariaLabel }) => {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return createPortal(
        <div className="aa-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} role="dialog" aria-modal="true">
            <div className={`aa-modal${variant ? ` aa-modal--${variant}` : ''}`} onClick={(e) => e.stopPropagation()} aria-label={ariaLabel || title}>
                <div className="aa-modal-head">
                    <h3 className="aa-modal-title">{title}</h3>
                    <button className="aa-btn aa-btn--ghost aa-btn--sm" onClick={onClose} aria-label="Close modal">
                        <FiX size={14} /> Close
                    </button>
                </div>
                <div className="aa-modal-body">{children}</div>
                {footer && <div className="aa-modal-foot">{footer}</div>}
            </div>
        </div>,
        document.body
    );
};

export default AsyncApiModal;
