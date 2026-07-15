// client/src/components/common/UrlBar/UrlBar.js
import React from 'react';
import { FiSend, FiSave } from 'react-icons/fi';
import './UrlBar.css';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const UrlBar = ({
    method,
    onMethodChange,
    url,
    onUrlChange,
    onSend,
    onSave,
    sending = false,
    saveLabel = 'Save',
    saveDisabled = false,
}) => (
    <div className="ub">
        <div className="ub__method">
            <select
                className="ub__method-select"
                value={method}
                onChange={(e) => onMethodChange && onMethodChange(e.target.value)}
                data-method={method}
                aria-label="HTTP method"
            >
                {METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
        </div>

        <input
            className="ub__url"
            type="text"
            value={url || ''}
            onChange={(e) => onUrlChange && onUrlChange(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            spellCheck={false}
            aria-label="Request URL"
        />

        <div className="ub__actions">
            {onSave && (
                <button
                    type="button"
                    className="ub__save"
                    onClick={onSave}
                    disabled={saveDisabled}
                >
                    <FiSave className="ub__btn-icon" />
                    <span>{saveLabel}</span>
                </button>
            )}
            <button
                type="button"
                className="ub__send"
                onClick={onSend}
                disabled={sending}
            >
                <FiSend className="ub__btn-icon" />
                <span>{sending ? 'Sending…' : 'Send'}</span>
            </button>
        </div>
    </div>
);

export default UrlBar;
