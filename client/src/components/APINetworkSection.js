import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
// import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import TrendingSection from './TrendingSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestWorkspace from './RequestWorkspace';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import APINetworkExplore from './APINetworkExplore';
import VisualApiDesigner from './VisualApiDesigner/VisualApiDesigner';
import './APINetworkSection.css';

const APINetworkSection = () => {
    const [requests, setRequests] = useState([]);
    const [response, setResponse] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/requests');
            const data = await res.json();
            setRequests(data);
        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    };

    const handleRequestSend = async (request) => {
        try {
            const res = await fetch(`/api/requests/${request._id}/send`, {
                method: 'POST',
            });
            const data = await res.json();
            setResponse(data);
            // Removed navigation to stay on the same page
        } catch (err) {
            console.error('Error sending request:', err);
        }
    };

    const handleRequestCreate = async (newRequestData) => {
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRequestData),
            });
            if (res.ok) {
                const savedRequest = await res.json();
                setRequests([...requests, savedRequest]);
                fetchRequests();
                navigate(`requests/${savedRequest._id}`);
            } else {
                const errorData = await res.json();
                console.error('Failed to create', errorData);
            }
        } catch (err) {
            console.error('Error creating request:', err);
        }
    };

    const handleRequestUpdate = async (updatedRequestData) => {
        try {
            const res = await fetch(`/api/requests/${updatedRequestData._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequestData),
            });
            if (res.ok) {
                const updatedRequest = await res.json();
                const updatedRequests = requests.map(req =>
                    req._id === updatedRequest._id ? updatedRequest : req
                );
                setRequests(updatedRequests);
                navigate(`requests/${updatedRequest._id}`);
            } else {
                const errorData = await res.json();
                console.error("Failed to update", errorData);
            }
        } catch (err) {
            console.error('Error updating request:', err);
        }
    };

    const handleRequestDelete = async (requestId) => {
        try {
            const res = await fetch(`/api/requests/${requestId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setRequests(requests.filter((req) => req._id !== requestId));
                navigate('explore');
            } else {
                const errorData = await res.json();
                console.error("Failed to delete", errorData);
            }
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    };

    // Direct request send handler for the unified workspace
    const handleDirectRequest = async (requestData) => {
        setResponse(null); // Clear previous response

        try {
            // Construct headers object
            const headers = {};
            requestData.headers.forEach(h => {
                if (h.enabled && h.key) {
                    headers[h.key] = h.value;
                }
            });

            // Prepare request body
            let requestBody = null;
            if (requestData.method !== 'GET' && requestData.method !== 'HEAD') {
                if (requestData.bodyType === 'raw' && requestData.body) {
                    requestBody = requestData.body;
                }
            }

            console.log(`Sending proxy request to ${requestData.url}`);

            // Use proxy endpoint instead of direct request
            const response = await fetch('/api/proxy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: requestData.url,
                    method: requestData.method,
                    headers,
                    body: requestBody,
                    timeout: 30000
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            const responseData = await response.json();

            setResponse(responseData);
        } catch (err) {
            console.error('Error making direct request:', err);
            setResponse({
                status: 0,
                statusText: 'Error',
                headers: {},
                body: err.message,
                error: true
            });
        }
    };

    return (
        <div className="api-network-section">
            <div className="api-network-main-content">
                <Routes>
                    <Route index element={<Navigate to="explore" />} />
                    <Route path="explore" element={<APINetworkExplore />} />
                    <Route path="spotlight" element={<SpotlightSection />} />
                    <Route path="trending" element={<TrendingSection />} />
                    <Route path="ai-agent-tools" element={<AIAgentToolsSection />} />
                    <Route
                        path="requests/new"
                        element={<UnifiedRequestWorkspace onSendRequest={handleDirectRequest} response={response} />}
                    />
                    <Route
                        path="requests/edit/:id"
                        element={<EditRequestWorkspace requests={requests} onSave={handleRequestUpdate} />}
                    />
                    <Route
                        path="requests/:id"
                        element={<RequestDetails requests={requests} response={response} onSend={handleRequestSend} />}
                    />
                </Routes>
            </div>
        </div>
    );
};

// New component that integrates request form and response display on the same page
const UnifiedRequestWorkspace = ({ onSendRequest, response }) => {
    // Default request with GET method
    const defaultRequest = {
        name: 'New Request',
        method: 'GET',
        url: '',
        params: [{ enabled: true, key: '', value: '', description: '' }],
        headers: [],
        bodyType: 'none',
        body: '',
        preRequestScript: '',
        tests: '',
        isNew: true
    };

    return (
        <div className="unified-request-workspace">
            <h2 className="request-workspace-title">New Request</h2>
            <div className="request-response-container">
                <div className="request-form-section">
                    <RequestForm
                        request={defaultRequest}
                        onSendRequest={onSendRequest}
                    />
                </div>

                <div className="response-section">
                    <h3>Response</h3>
                    {response ? (
                        <ResponseDisplay responseData={response} />
                    ) : (
                        <div className="empty-response-message">
                            <p>Send a request to see the response</p>
                        </div>
                    )}
                </div>

                {/* Visual API Designer section - moved here after Preview section */}
                <div className="visual-api-designer-section">
                    <h3>🎨 Visual API Designer</h3>
                    <VisualApiDesigner
                        collectionId={defaultRequest.collectionId}
                        onSpecUpdate={(spec) => {
                            // Update the request with the generated OpenAPI spec
                            console.log('OpenAPI spec generated:', spec);
                            // You can handle the spec update here if needed
                        }}
                        initialSpec={null}
                    />
                </div>
            </div>
        </div>
    );
}

const RequestDetails = ({ requests, response, onSend }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Loading request details...</div>;
    }

    return (
        <>
            <h2>Request Details</h2>
            <p>
                <strong>Name:</strong> {request.name}
            </p>
            <p>
                <strong>URL:</strong> {request.url}
            </p>
            <p>
                <strong>Method:</strong> {request.method}
            </p>
            <button className="send-request-button" onClick={() => onSend(request)}>
                Send Request
            </button>
            <button className='edit-request-button' onClick={() => navigate(`../requests/edit/${request._id}`)}>Edit</button>
            {response && <ResponseDisplay responseData={response} />}
        </>
    );
};

const EditRequestWorkspace = ({ requests, onSave }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Request not found</div>;
    }

    const handleSave = (savedRequest) => {
        onSave(savedRequest);
        navigate(`../requests/${id}`);
    };

    return (
        <RequestWorkspace initialRequest={request} onSave={handleSave} />
    );
};

export default APINetworkSection;