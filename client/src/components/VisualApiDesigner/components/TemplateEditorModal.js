import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AppSelect from '../../common/AppSelect/AppSelect';
import '../../common/AppSelect/AppSelect.css';

const TemplateEditorModal = ({
    selectedTemplate,
    templateLibrary,
    customTemplate,
    previewData,
    onClose,
    onSelectTemplate,
    onTemplateChange,
    onCreate
}) => {
    const modalRef = useRef(null);
    const lastFocusedRef = useRef(null);

    useEffect(() => {
        lastFocusedRef.current = document.activeElement;
        const modal = modalRef.current;
        if (!modal) return;

        const focusable = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        const trap = (e) => {
            if (e.key !== 'Tab') return;
            if (focusable.length === 0) return;

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        modal.addEventListener('keydown', trap);
        document.addEventListener('keydown', handleEsc);
        return () => {
            modal.removeEventListener('keydown', trap);
            document.removeEventListener('keydown', handleEsc);
            lastFocusedRef.current?.focus();
        };
    }, [onClose]);

    return createPortal(
        <div className="template-editor-modal">
            <div className="modal-overlay" onClick={onClose} />
            <div
                ref={modalRef}
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="modal-header">
                    <h3 id="modal-title">Create Custom Visualization</h3>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close dialog"
                        autoFocus
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </div>

                <form
                    className="modal-body"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onCreate();
                    }}
                >
                    <div className="template-section">
                        <label htmlFor="tpl-select">Use Prebuilt Template:</label>
                        <AppSelect
                            id="tpl-select"
                            className="template-select"
                            value={selectedTemplate}
                            onChange={onSelectTemplate}
                            options={[
                                { value: '', label: 'Custom Template' },
                                ...templateLibrary.map((template) => ({
                                    value: template.id,
                                    label: `${template.name} - ${template.description}`
                                }))
                            ]}
                        />
                    </div>

                    <div className="template-section">
                        <label htmlFor="tpl-textarea">Template (Handlebars syntax):</label>
                        <textarea
                            id="tpl-textarea"
                            name="template"
                            value={customTemplate}
                            onChange={(e) => onTemplateChange(e.target.value)}
                            placeholder="Enter your Handlebars template here..."
                            className="template-textarea ts-textarea"
                            rows={10}
                        />
                    </div>

                    <div className="template-section">
                        <label htmlFor="tpl-data">Available Data:</label>
                        <pre id="tpl-data" className="data-preview">
                            {JSON.stringify(previewData, null, 2)}
                        </pre>
                    </div>
                </form>

                <div className="modal-footer">
                    <button
                        className="ts-btn"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="ts-btn primary"
                        onClick={onCreate}
                    >
                        Create Visualization
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TemplateEditorModal;
