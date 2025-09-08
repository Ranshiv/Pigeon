import React, { useState } from 'react';
import { FiX, FiSave, FiInfo, FiTag, FiFileText } from 'react-icons/fi';
import './VersionCreationModal.css';

const VersionCreationModal = ({
    isOpen,
    onClose,
    onSave,
    collectionId,
    openApiSpec,
    isLoading = false
}) => {
    const [formData, setFormData] = useState({
        version: '',
        name: '',
        description: '',
        changelog: '',
        isBackwardCompatible: true
    });
    const [errors, setErrors] = useState({});

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.version.trim()) {
            newErrors.version = 'Version is required';
        } else if (!/^v?\d+(\.\d+){0,2}$/.test(formData.version.trim())) {
            newErrors.version = 'Invalid version format. Use v1, v1.0, v1.0.0, 1, 1.0, or 1.0.0';
        }

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        const versionData = {
            ...formData,
            openApiSpec,
            collectionId
        };

        try {
            await onSave(versionData);
            setFormData({
                version: '',
                name: '',
                description: '',
                changelog: '',
                isBackwardCompatible: true
            });
            onClose();
        } catch (error) {
            console.error('Error creating version:', error);
        }
    };

    const handleClose = () => {
        setFormData({
            version: '',
            name: '',
            description: '',
            changelog: '',
            isBackwardCompatible: true
        });
        setErrors({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="version-modal-overlay" onClick={handleClose}>
            <div className="version-modal" onClick={e => e.stopPropagation()}>
                <div className="version-modal-header">
                    <div className="modal-title">
                        <FiTag className="title-icon" />
                        <h2>Save as API Version</h2>
                    </div>
                    <button
                        type="button"
                        className="close-btn"
                        onClick={handleClose}
                        aria-label="Close modal"
                        disabled={isLoading}
                    >
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="version-modal-form">
                    <div className="form-section">
                        <div className="section-header">
                            <FiInfo className="section-icon" />
                            <h3>Version Information</h3>
                        </div>

                        <div className="form-row">
                            <div className="form-group required">
                                <label htmlFor="version">Version Number</label>
                                <input
                                    type="text"
                                    id="version"
                                    name="version"
                                    value={formData.version}
                                    onChange={handleInputChange}
                                    placeholder="e.g., v1.0.0 or 1.0.0"
                                    className={errors.version ? 'error' : ''}
                                    disabled={isLoading}
                                />
                                {errors.version && (
                                    <span className="error-message">{errors.version}</span>
                                )}
                                <div className="field-hint">
                                    Use semantic versioning (e.g., v1.0.0 for major.minor.patch)
                                </div>
                            </div>

                            <div className="form-group required">
                                <label htmlFor="name">Version Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Initial Release"
                                    className={errors.name ? 'error' : ''}
                                    disabled={isLoading}
                                />
                                {errors.name && (
                                    <span className="error-message">{errors.name}</span>
                                )}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Brief description of this API version..."
                                rows={3}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="changelog">Changelog</label>
                            <textarea
                                id="changelog"
                                name="changelog"
                                value={formData.changelog}
                                onChange={handleInputChange}
                                placeholder="What's new or changed in this version..."
                                rows={4}
                                disabled={isLoading}
                            />
                            <div className="field-hint">
                                Document new features, improvements, and breaking changes
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="isBackwardCompatible"
                                    checked={formData.isBackwardCompatible}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                />
                                <span className="checkbox-text">
                                    Backward Compatible
                                </span>
                            </label>
                            <div className="field-hint">
                                This version maintains compatibility with previous versions
                            </div>
                        </div>
                    </div>

                    <div className="spec-preview-section">
                        <div className="section-header">
                            <FiFileText className="section-icon" />
                            <h3>OpenAPI Specification Preview</h3>
                        </div>
                        <div className="spec-summary">
                            {openApiSpec ? (
                                <div className="spec-stats">
                                    <span className="stat">
                                        <strong>Title:</strong> {openApiSpec.info?.title || 'Generated API'}
                                    </span>
                                    <span className="stat">
                                        <strong>Paths:</strong> {Object.keys(openApiSpec.paths || {}).length}
                                    </span>
                                    <span className="stat">
                                        <strong>Schemas:</strong> {Object.keys(openApiSpec.components?.schemas || {}).length}
                                    </span>
                                </div>
                            ) : (
                                <span className="no-spec">No OpenAPI specification available</span>
                            )}
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isLoading || !openApiSpec}
                        >
                            <FiSave className="btn-icon" />
                            {isLoading ? 'Saving...' : 'Save Version'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VersionCreationModal;
