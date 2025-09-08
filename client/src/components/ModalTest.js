import React, { useState } from 'react';
import './ApiVersionManager.css';

const ModalTest = () => {
    const [showModal, setShowModal] = useState(false);

    return (
        <div style={{ padding: '20px' }}>
            <h2>Modal Positioning Test</h2>
            <button
                onClick={() => setShowModal(true)}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                }}
            >
                Test Modal Position
            </button>

            {showModal && (
                <div className="diff-modal-overlay">
                    <div className="diff-modal">
                        <div className="diff-header">
                            <h3>🔧 Modal Position Test</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowModal(false)}
                                aria-label="Close modal"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="version-selector">
                            <p>This modal should be perfectly centered!</p>

                            <div style={{
                                padding: '20px',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                margin: '20px 0'
                            }}>
                                <p>✅ Horizontally centered</p>
                                <p>✅ Vertically centered</p>
                                <p>✅ Proper backdrop</p>
                                <p>✅ Responsive design</p>
                            </div>

                            <div className="diff-actions">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="cancel-btn"
                                >
                                    Close Test
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModalTest;
