import React, { useState, useEffect, useRef } from 'react';
import './SampleDataManager.css';
import {
    FiPlus, FiTrash2, FiSave, FiDownload, FiUpload, FiCopy,
    FiCheck, FiCode, FiDatabase, FiSearch, FiGrid, FiLayout,
    FiFilter, FiTag, FiCoffee, FiUser, FiShoppingCart, FiCalendar,
    FiMap, FiList, FiAlertTriangle, FiRefreshCw, FiEdit
} from 'react-icons/fi';

function SampleDataManager({ collectionId }) {
    // Core state
    const [datasets, setDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isEdited, setIsEdited] = useState(false);

    // UI state
    const [viewMode, setViewMode] = useState('editor'); // 'editor', 'split', 'preview'
    const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [newDatasetName, setNewDatasetName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [jsonError, setJsonError] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Refs
    const fileInputRef = useRef(null);

    // Sample template categories
    const templates = [
        {
            id: 'user', name: 'User Profile', icon: <FiUser />,
            sample: { name: "John Doe", email: "john@example.com", age: 30, roles: ["user", "admin"] }
        },
        {
            id: 'product', name: 'Product', icon: <FiShoppingCart />,
            sample: { id: "prod-001", name: "Sample Product", price: 29.99, inStock: true, categories: ["electronics"] }
        },
        {
            id: 'event', name: 'Event', icon: <FiCalendar />,
            sample: { title: "Team Meeting", date: "2025-05-30T10:00:00", location: "Conference Room", attendees: [] }
        },
        {
            id: 'location', name: 'Location', icon: <FiMap />,
            sample: { address: "123 Main St", city: "Anytown", state: "CA", postalCode: "12345", coordinates: { lat: 34.052235, long: -118.243683 } }
        },
        {
            id: 'config', name: 'Config', icon: <FiCoffee />,
            sample: { appName: "MyApp", version: "1.0.0", features: { darkMode: true, notifications: true, analytics: false } }
        }
    ];

    // Fetch datasets when component mounts or collectionId changes
    useEffect(() => {
        if (collectionId) {
            fetchDatasets();
        }
    }, [collectionId]);

    // Validate JSON and return result
    const validateJson = (jsonString) => {
        try {
            JSON.parse(jsonString);
            setJsonError(null);
            return true;
        } catch (err) {
            setJsonError(err.message);
            return false;
        }
    };

    // Filter datasets based on search term and category
    const getFilteredDatasets = () => {
        return datasets.filter(dataset => {
            // Apply search filter
            const matchesSearch = searchTerm === '' ||
                dataset.name.toLowerCase().includes(searchTerm.toLowerCase());

            // Apply category filter
            const matchesCategory = selectedCategory === 'all' ||
                (dataset.category && dataset.category === selectedCategory);

            return matchesSearch && matchesCategory;
        });
    };

    // Fetch all datasets for the collection
    const fetchDatasets = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/collections/${collectionId}/sample-data`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch datasets: ${response.statusText}`);
            }

            const data = await response.json();
            setDatasets(data);

            // Select the first dataset by default if available
            if (data.length > 0 && !selectedDataset) {
                setSelectedDataset(data[0]);
                setEditorContent(JSON.stringify(data[0].content, null, 2));
            }
        } catch (err) {
            console.error('Error fetching datasets:', err);
            setError(`Error fetching sample datasets: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle dataset selection
    const handleSelectDataset = (dataset) => {
        // Check if there are unsaved changes
        if (isEdited) {
            if (!window.confirm('You have unsaved changes. Discard them?')) {
                return;
            }
        }

        setSelectedDataset(dataset);
        setEditorContent(JSON.stringify(dataset.content, null, 2));
        setIsEdited(false);
    };

    // Handle editor content change
    const handleEditorChange = (e) => {
        setEditorContent(e.target.value);
        setIsEdited(true);

        // Validate JSON as you type (but with debounce for performance)
        clearTimeout(window.jsonValidationTimeout);
        window.jsonValidationTimeout = setTimeout(() => {
            validateJson(e.target.value);
        }, 800);
    };

    // Apply a template
    const applyTemplate = (template) => {
        if (isEdited && !window.confirm('You have unsaved changes. Apply template anyway?')) {
            return;
        }

        const newContent = JSON.stringify(template.sample, null, 2);
        setEditorContent(newContent);
        setIsEdited(true);
        setShowTemplateModal(false);
    };

    // Create a new dataset
    const handleCreateDataset = async () => {
        if (!newDatasetName.trim()) {
            alert('Please enter a dataset name');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/collections/${collectionId}/sample-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: newDatasetName,
                    content: {}
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create dataset: ${response.statusText}`);
            }

            const newDataset = await response.json();
            setDatasets([...datasets, newDataset]);
            setSelectedDataset(newDataset);
            setEditorContent(JSON.stringify(newDataset.content, null, 2));
            setShowNewDatasetModal(false);
            setNewDatasetName('');
            setIsEdited(false);
        } catch (err) {
            console.error('Error creating dataset:', err);
            setError(`Error creating dataset: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Save the current dataset
    const handleSaveDataset = async () => {
        if (!selectedDataset) return;

        try {
            setLoading(true);
            setError(null);

            // Validate JSON
            let contentObj;
            try {
                contentObj = JSON.parse(editorContent);
            } catch (err) {
                throw new Error('Invalid JSON format. Please check your syntax.');
            }

            const response = await fetch(`/api/collections/${collectionId}/sample-data/${selectedDataset._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    content: contentObj
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to save dataset: ${response.statusText}`);
            }

            const updatedDataset = await response.json();

            // Update the datasets array with the updated dataset
            const updatedDatasets = datasets.map(ds =>
                ds._id === updatedDataset._id ? updatedDataset : ds
            );

            setDatasets(updatedDatasets);
            setSelectedDataset(updatedDataset);
            setIsEdited(false);
            alert('Dataset saved successfully!');
        } catch (err) {
            console.error('Error saving dataset:', err);
            setError(`Error saving dataset: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Delete the current dataset
    const handleDeleteDataset = async () => {
        if (!selectedDataset) return;

        if (!window.confirm(`Are you sure you want to delete the dataset "${selectedDataset.name}"?`)) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/collections/${collectionId}/sample-data/${selectedDataset._id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete dataset: ${response.statusText}`);
            }

            // Remove the deleted dataset from the datasets array
            const updatedDatasets = datasets.filter(ds => ds._id !== selectedDataset._id);
            setDatasets(updatedDatasets);

            // Select another dataset if available
            if (updatedDatasets.length > 0) {
                setSelectedDataset(updatedDatasets[0]);
                setEditorContent(JSON.stringify(updatedDatasets[0].content, null, 2));
            } else {
                setSelectedDataset(null);
                setEditorContent('');
            }

            setIsEdited(false);
        } catch (err) {
            console.error('Error deleting dataset:', err);
            setError(`Error deleting dataset: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle file import
    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                // Validate JSON
                const content = JSON.parse(event.target.result);
                setEditorContent(JSON.stringify(content, null, 2));
                setIsEdited(true);
            } catch (err) {
                setError('Invalid JSON file. Please check the file format.');
            }
        };
        reader.onerror = () => {
            setError('Error reading file.');
        };
        reader.readAsText(file);

        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle file export
    const handleExportFile = () => {
        if (!selectedDataset) return;

        try {
            // Create a blob with the editor content
            const blob = new Blob([editorContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // Create a download link and trigger it
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedDataset.name}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(`Error exporting file: ${err.message}`);
        }
    };

    // Handle using this dataset in a request
    const handleUseDataset = () => {
        if (!selectedDataset) return;

        try {
            const contentObj = JSON.parse(editorContent);
            localStorage.setItem('lastUsedSampleData', JSON.stringify({
                name: selectedDataset.name,
                content: contentObj
            }));
            alert(`Dataset "${selectedDataset.name}" is now available to use in requests!`);
        } catch (err) {
            setError(`Error preparing dataset for use: ${err.message}`);
        }
    };

    // Format the JSON in the editor
    const handleFormatJson = () => {
        if (validateJson(editorContent)) {
            const contentObj = JSON.parse(editorContent);
            setEditorContent(JSON.stringify(contentObj, null, 2));
        } else {
            setError('Invalid JSON format. Please check your syntax.');
        }
    };

    // Toggle view mode (editor/split/preview)
    const toggleViewMode = (mode) => {
        if (mode !== viewMode) {
            setViewMode(mode);
        }
    };

    // Modal for creating a new dataset
    const renderNewDatasetModal = () => {
        if (!showNewDatasetModal) return null;

        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h2>Create New Dataset</h2>
                    <div className="form-group">
                        <label htmlFor="datasetName">Dataset Name</label>
                        <input
                            type="text"
                            id="datasetName"
                            value={newDatasetName}
                            onChange={(e) => setNewDatasetName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="modal-actions">
                        <button
                            className="cancel-btn"
                            onClick={() => {
                                setShowNewDatasetModal(false);
                                setNewDatasetName('');
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="create-btn"
                            onClick={handleCreateDataset}
                            disabled={!newDatasetName.trim()}
                        >
                            Create Dataset
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Modal for selecting a template
    const renderTemplateModal = () => {
        if (!showTemplateModal) return null;

        return (
            <div className="modal-overlay">
                <div className="modal-content template-modal">
                    <h2>Select a Template</h2>
                    <p className="modal-subtitle">Choose a template as a starting point for your sample data</p>

                    <div className="template-grid">
                        {templates.map(template => (
                            <div
                                key={template.id}
                                className="template-item"
                                onClick={() => applyTemplate(template)}
                            >
                                <div className="template-icon">{template.icon}</div>
                                <div className="template-name">{template.name}</div>
                            </div>
                        ))}

                        <div className="template-item template-custom">
                            <div className="template-icon"><FiCode /></div>
                            <div className="template-name">Custom</div>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="cancel-btn" onClick={() => setShowTemplateModal(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render the top toolbar shown in the screenshot
    // Render editor toolbar with formatting and data management options
    const renderTopToolbar = () => {
        return (
            <div className="top-toolbar">
                <div className="toolbar-button-group">
                    <button className="toolbar-button" onClick={handleFormatJson}>
                        <FiCode className="icon" /> Format
                    </button>
                    <label className="toolbar-button">
                        <FiUpload className="icon" /> Import
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImportFile}
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                        />
                    </label>
                    <button className="toolbar-button" onClick={handleExportFile}>
                        <FiDownload className="icon" /> Export
                    </button>
                    <button className="toolbar-button validate" onClick={() => validateJson(editorContent)}>
                        <FiCheck className="icon" /> Validate
                    </button>
                    <button
                        className="toolbar-button save"
                        onClick={handleSaveDataset}
                        disabled={loading || !isEdited}
                    >
                        <FiSave className="icon" /> Save
                    </button>
                </div>
                <button className="use-data-button" onClick={handleUseDataset} disabled={loading}>
                    Use Data
                </button>
            </div>
        );
    };

    return (
        <div className="sample-data-manager">
            <div className="sample-data-header">
                <div className="header-left">
                    <h2><FiDatabase className="icon" /> Sample Data Manager</h2>
                    <p className="header-subtitle">Create and manage sample data for your API requests</p>
                </div>
                <div className="sample-data-actions">
                    <button
                        className="action-btn template-btn"
                        onClick={() => setShowTemplateModal(true)}
                        title="Use a template to create sample data"
                    >
                        <FiCode className="icon" /> Templates
                    </button>
                    <button
                        className="action-btn"
                        onClick={() => setShowNewDatasetModal(true)}
                    >
                        <FiPlus className="icon" /> New Dataset
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {jsonError && <div className="json-error-message"><FiAlertTriangle className="icon" /> {jsonError}</div>}

            <div className="sample-data-content">
                <div className="datasets-sidebar">
                    <div className="datasets-search">
                        <div className="search-input-container">
                            <FiSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search datasets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="dataset-categories">
                        <button
                            className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('all')}
                        >
                            All Datasets
                        </button>
                        <button
                            className={`category-btn ${selectedCategory === 'user' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('user')}
                        >
                            <FiUser className="icon" /> Users
                        </button>
                        <button
                            className={`category-btn ${selectedCategory === 'product' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('product')}
                        >
                            <FiShoppingCart className="icon" /> Products
                        </button>
                    </div>

                    <div className="datasets-list">
                        <h3>Datasets <span className="dataset-count">{getFilteredDatasets().length}</span></h3>
                        {datasets.length === 0 ? (
                            <div className="no-datasets">No datasets available</div>
                        ) : getFilteredDatasets().length === 0 ? (
                            <div className="no-datasets">No matching datasets</div>
                        ) : (
                            <ul>
                                {getFilteredDatasets().map(dataset => (
                                    <li
                                        key={dataset._id}
                                        className={selectedDataset && selectedDataset._id === dataset._id ? 'active' : ''}
                                        onClick={() => handleSelectDataset(dataset)}
                                    >
                                        <span className="dataset-name">{dataset.name}</span>
                                        <span className="dataset-size">
                                            {dataset.content ?
                                                `${JSON.stringify(dataset.content).length} bytes` :
                                                '0 bytes'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="dataset-editor">
                    {selectedDataset ? (
                        <>
                            {/* Data editor toolbar with formatting, import/export, validation, and save options */}
                            {renderTopToolbar()}

                            <div className={`editor-container ${viewMode}-mode`}>
                                {(viewMode === 'editor' || viewMode === 'split') && (
                                    <div className="code-editor-container">
                                        <textarea
                                            className={`json-editor ${jsonError ? 'has-error' : ''}`}
                                            value={editorContent}
                                            onChange={handleEditorChange}
                                            spellCheck="false"
                                            disabled={loading}
                                            placeholder="Enter JSON data here..."
                                        />
                                        {jsonError && (
                                            <div className="inline-error-message">
                                                <FiAlertTriangle className="icon" /> {jsonError}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(viewMode === 'preview' || viewMode === 'split') && (
                                    <div className="preview-container">
                                        <div className="preview-header">
                                            <h3>Preview</h3>
                                        </div>
                                        <div className="json-preview">
                                            {validateJson(editorContent) ? (
                                                <div className="formatted-preview">
                                                    {Object.entries(JSON.parse(editorContent)).map(([key, value]) => (
                                                        <div className="preview-item" key={key}>
                                                            <div className="preview-key">{key}:</div>
                                                            <div className="preview-value">
                                                                {typeof value === 'object'
                                                                    ? JSON.stringify(value)
                                                                    : String(value)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="preview-error">
                                                    <FiAlertTriangle className="icon" />
                                                    <span>Invalid JSON. Fix errors to see preview.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="no-dataset-selected">
                            <div className="empty-state">
                                <FiDatabase className="empty-icon" />
                                <h3>No Dataset Selected</h3>
                                <p>Select a dataset from the list or create a new one to get started.</p>
                                <div className="empty-actions">
                                    <button
                                        className="action-btn create-btn"
                                        onClick={() => setShowNewDatasetModal(true)}
                                    >
                                        <FiPlus className="icon" /> Create New Dataset
                                    </button>
                                    <button
                                        className="action-btn template-btn"
                                        onClick={() => setShowTemplateModal(true)}
                                    >
                                        <FiCode className="icon" /> Use Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {renderNewDatasetModal()}
            {renderTemplateModal()}
        </div>
    );
}

export default SampleDataManager;