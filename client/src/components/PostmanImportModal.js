import React, { useEffect, useState } from 'react';
import {
    FiAlertTriangle,
    FiCheckCircle,
    FiFileText,
    FiFolder,
    FiLayers,
    FiUploadCloud,
    FiX
} from 'react-icons/fi';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const countCollectionItems = (items) => (Array.isArray(items) ? items : []).reduce((summary, item) => {
    if (Array.isArray(item?.item)) {
        const nested = countCollectionItems(item.item);
        summary.folders += 1 + nested.folders;
        summary.requests += nested.requests;
        summary.scripts += nested.scripts + (Array.isArray(item.event) ? item.event.length : 0);
    } else if (item?.request) {
        summary.requests += 1;
        summary.scripts += Array.isArray(item.event) ? item.event.length : 0;
    }
    return summary;
}, { requests: 0, folders: 0, scripts: 0 });

const inspectPostmanDocument = (document) => {
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        throw new Error('The file must contain a JSON object.');
    }
    if (document.info && Array.isArray(document.item)) {
        const counts = countCollectionItems(document.item);
        return {
            kind: 'collection',
            name: document.info.name || 'Untitled Postman Collection',
            ...counts,
            variables: Array.isArray(document.variable) ? document.variable.length : 0,
            secretVariables: (document.variable || []).filter((variable) => variable?.type === 'secret').length
        };
    }
    if (Array.isArray(document.values)) {
        return {
            kind: 'environment',
            name: document.name || 'Untitled Postman Environment',
            variables: document.values.filter((variable) => variable?.enabled !== false).length,
            disabledVariables: document.values.filter((variable) => variable?.enabled === false).length,
            secretVariables: document.values.filter((variable) => variable?.type === 'secret').length
        };
    }
    throw new Error('This is not a Postman collection or environment export.');
};

const formatFileSize = (bytes) => {
    const isMegabytes = bytes >= 1024 * 1024;
    const divisor = isMegabytes ? 1024 * 1024 : 1024;
    return `${(bytes / divisor).toFixed(1)} ${isMegabytes ? 'MB' : 'KB'}`;
};

const PostmanImportModal = ({ isOpen, onClose, onImported, onOpenCollection, workspaceId }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!isOpen) return undefined;
        setFile(null);
        setPreview(null);
        setError('');
        setResult(null);
        setIsImporting(false);
        setIsDragging(false);
        return undefined;
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !isImporting) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isImporting, onClose]);

    const inspectFile = async (nextFile) => {
        setError('');
        setResult(null);
        setPreview(null);
        setFile(null);
        if (!nextFile) return;
        if (!nextFile.name.toLowerCase().endsWith('.json')) {
            setError('Choose a Postman .json export.');
            return;
        }
        if (nextFile.size > MAX_IMPORT_BYTES) {
            setError('Postman exports must be smaller than 5 MB.');
            return;
        }
        try {
            const document = JSON.parse((await nextFile.text()).replace(/^\uFEFF/, ''));
            setPreview(inspectPostmanDocument(document));
            setFile(nextFile);
        } catch (nextError) {
            setError(nextError instanceof SyntaxError ? 'The selected file does not contain valid JSON.' : nextError.message);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!file || !preview) return;
        setIsImporting(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (workspaceId) formData.append('workspaceId', workspaceId);
            const response = await fetch('/api/imports/postman', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Postman import failed.');
            setResult(data);
            onImported?.(data);
        } catch (nextError) {
            setError(nextError.message || 'Postman import failed.');
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="postman-import-overlay" onMouseDown={(event) => event.target === event.currentTarget && !isImporting && onClose()}>
            <section className="postman-import-modal" role="dialog" aria-modal="true" aria-labelledby="postman-import-title">
                <header className="postman-import-header">
                    <div>
                        <span className="postman-import-eyebrow">Migration Center</span>
                        <h2 id="postman-import-title">Import from Postman</h2>
                        <p>Bring a Postman Collection v2.x or environment into Pigeon.</p>
                    </div>
                    <button type="button" className="postman-import-close" onClick={onClose} disabled={isImporting} aria-label="Close import dialog">
                        <FiX />
                    </button>
                </header>

                {result ? (
                    <div className="postman-import-result">
                        <FiCheckCircle className="postman-import-success-icon" aria-hidden="true" />
                        <h3>{result.kind === 'collection' ? 'Collection imported' : 'Environment imported'}</h3>
                        <p>{result.message}</p>
                        <div className="postman-import-result-card">
                            <strong>{result.resource.name}</strong>
                            <span>
                                {result.kind === 'collection'
                                    ? `${result.resource.requestCount} requests · ${result.resource.variableCount} variables`
                                    : `${result.resource.variableCount} variables`}
                            </span>
                        </div>
                        {result.warnings?.length > 0 && (
                            <div className="postman-import-warnings">
                                <div className="postman-import-warning-title"><FiAlertTriangle /> Review after import</div>
                                <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                            </div>
                        )}
                        <div className="postman-import-actions">
                            <button type="button" className="postman-import-secondary" onClick={onClose}>Done</button>
                            {result.kind === 'collection' && (
                                <button type="button" className="postman-import-primary" onClick={() => onOpenCollection?.(result.resource._id)}>
                                    Open collection
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <label
                            className={`postman-import-dropzone${isDragging ? ' dragging' : ''}${preview ? ' ready' : ''}`}
                            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setIsDragging(false);
                                inspectFile(event.dataTransfer.files?.[0]);
                            }}
                        >
                            <input
                                type="file"
                                accept="application/json,.json"
                                onChange={(event) => inspectFile(event.target.files?.[0])}
                                disabled={isImporting}
                            />
                            <FiUploadCloud className="postman-import-upload-icon" aria-hidden="true" />
                            <strong>{file ? file.name : 'Choose a Postman JSON export'}</strong>
                            <span>{file ? formatFileSize(file.size) : 'or drag and drop it here · maximum 5 MB'}</span>
                        </label>

                        {error && <div className="postman-import-error" role="alert"><FiAlertTriangle /> {error}</div>}

                        {preview && (
                            <div className="postman-import-preview">
                                <div className="postman-import-preview-icon">
                                    {preview.kind === 'collection' ? <FiFolder /> : <FiLayers />}
                                </div>
                                <div className="postman-import-preview-copy">
                                    <span>{preview.kind === 'collection' ? 'Postman collection' : 'Postman environment'}</span>
                                    <strong>{preview.name}</strong>
                                    <div className="postman-import-stats">
                                        {preview.kind === 'collection' && <span><FiFileText /> {preview.requests} requests</span>}
                                        {preview.kind === 'collection' && <span><FiFolder /> {preview.folders} folders</span>}
                                        <span><FiLayers /> {preview.variables} variables</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {preview?.scripts > 0 && (
                            <div className="postman-import-note">
                                <FiAlertTriangle /> {preview.scripts} script hook{preview.scripts === 1 ? '' : 's'} will be preserved. Some pm.* APIs may need manual migration.
                            </div>
                        )}
                        {preview?.secretVariables > 0 && (
                            <div className="postman-import-note">
                                <FiAlertTriangle /> This export contains {preview.secretVariables} secret variable{preview.secretVariables === 1 ? '' : 's'}. Review the imported values and rotate shared credentials.
                            </div>
                        )}

                        <div className="postman-import-actions">
                            <button type="button" className="postman-import-secondary" onClick={onClose} disabled={isImporting}>Cancel</button>
                            <button type="submit" className="postman-import-primary" disabled={!preview || isImporting}>
                                <FiUploadCloud /> {isImporting ? 'Importing…' : `Import ${preview?.kind || ''}`.trim()}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
};

export default PostmanImportModal;
