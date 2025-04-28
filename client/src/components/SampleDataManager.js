import React, { useState, useEffect, useRef } from 'react';
import './SampleDataManager.css';
import { FiPlus, FiTrash2, FiSave, FiDownload, FiUpload, FiCopy, FiCheck, FiCode, FiDatabase } from 'react-icons/fi';

function SampleDataManager({ collectionId }) {
    const [datasets, setDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
    const [newDatasetName, setNewDatasetName] = useState('');
    const [isEdited, setIsEdited] = useState(false);
    const fileInputRef = useRef(null);

    // Fetch datasets when component mounts or collectionId changes
    useEffect(() => {
        if (collectionId) {
            fetchDatasets();
        }
    }, [collectionId]);

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
        try {
            const contentObj = JSON.parse(editorContent);
            setEditorContent(JSON.stringify(contentObj, null, 2));
        } catch (err) {
            setError('Invalid JSON format. Please check your syntax.');
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

    return (
        <div className="sample-data-manager">
            <div className="sample-data-header">
                <h2><FiDatabase className="icon" /> Sample Data Manager</h2>
                <div className="sample-data-actions">
                    <button
                        className="action-btn"
                        onClick={() => setShowNewDatasetModal(true)}
                    >
                        <FiPlus className="icon" /> New Dataset
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="sample-data-content">
                <div className="datasets-list">
                    <h3>Datasets</h3>
                    {datasets.length === 0 ? (
                        <div className="no-datasets">No datasets available</div>
                    ) : (
                        <ul>
                            {datasets.map(dataset => (
                                <li
                                    key={dataset._id}
                                    className={selectedDataset && selectedDataset._id === dataset._id ? 'active' : ''}
                                    onClick={() => handleSelectDataset(dataset)}
                                >
                                    {dataset.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="dataset-editor">
                    {selectedDataset ? (
                        <>
                            <div className="editor-toolbar">
                                <span className="dataset-name">{selectedDataset.name}</span>
                                <div className="editor-actions">
                                    <button
                                        className="editor-btn"
                                        onClick={handleFormatJson}
                                        title="Format JSON"
                                    >
                                        <FiCode className="icon" />
                                    </button>
                                    <label className="editor-btn import-btn" title="Import JSON">
                                        <FiUpload className="icon" />
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImportFile}
                                            ref={fileInputRef}
                                        />
                                    </label>
                                    <button
                                        className="editor-btn"
                                        onClick={handleExportFile}
                                        title="Export JSON"
                                    >
                                        <FiDownload className="icon" />
                                    </button>
                                    <button
                                        className="editor-btn"
                                        onClick={handleSaveDataset}
                                        disabled={loading || !isEdited}
                                        title="Save Dataset"
                                    >
                                        <FiSave className="icon" />
                                    </button>
                                    <button
                                        className="editor-btn"
                                        onClick={handleDeleteDataset}
                                        disabled={loading}
                                        title="Delete Dataset"
                                    >
                                        <FiTrash2 className="icon" />
                                    </button>
                                    <button
                                        className="editor-btn use-data-btn"
                                        onClick={handleUseDataset}
                                        disabled={loading}
                                        title="Use this data in requests"
                                    >
                                        <FiCopy className="icon" /> Use Data
                                    </button>
                                </div>
                            </div>
                            <textarea
                                className="json-editor"
                                value={editorContent}
                                onChange={handleEditorChange}
                                spellCheck="false"
                                disabled={loading}
                                placeholder="Enter JSON data here..."
                            />
                        </>
                    ) : (
                        <div className="no-dataset-selected">
                            <p>No dataset selected. Please select a dataset from the list or create a new one.</p>
                            <button
                                className="action-btn"
                                onClick={() => setShowNewDatasetModal(true)}
                            >
                                <FiPlus className="icon" /> Create New Dataset
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {renderNewDatasetModal()}
        </div>
    );
}

export default SampleDataManager;