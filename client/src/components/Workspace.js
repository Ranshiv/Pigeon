// client/src/components/Workspace.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom'; // Import Navigate
import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import TrendingSection from './TrendingSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import './Workspace.css';

const Workspace = () => {
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
            navigate(`/workspace/requests/${request._id}`);
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
                fetchRequests()
                navigate(`/workspace/requests/${savedRequest._id}`);
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
                const updatedRequests = requests.map((req) =>
                    req._id === updatedRequest._id ? updatedRequest : req
                );
                setRequests(updatedRequests);
                navigate(`/workspace/requests/${updatedRequest._id}`);
            } else {
                const errorData = await res.json();
                console.error('Failed to update', errorData);
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
                navigate('/workspace/explore'); // Navigate to explore after deleting
            } else {
                const errorData = await res.json();
                console.error('Failed to delete', errorData);
            }
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    };

    return (
        <div className="workspace-container">
            <div className="sidebar">
                <div className="sidebar-section" onClick={() => navigate('/workspace/explore')}>
                    Explore
                </div>
                <div className="sidebar-section" onClick={() => navigate('/workspace/spotlight')}>
                    Spotlight
                </div>
                <div className="sidebar-section" onClick={() => navigate('/workspace/trending')}>
                    Trending
                </div>
                <div className="sidebar-section" onClick={() => navigate('/workspace/ai-agent-tools')}>
                    AI Agent Tools
                </div>
                <div className="sidebar-section" onClick={() => navigate('/workspace/requests/new')}>
                    Add Request
                </div>
            </div>
            <div className="main-content">
                <Routes>
                    {/* Redirect /workspace to /workspace/explore */}
                    <Route path="/" element={<Navigate to="/workspace/explore" />} />
                    <Route path="/explore" element={<ExploreSection requests={requests} onSend={handleRequestSend} onDelete={handleRequestDelete} onSelect={(request) => navigate(`/workspace/requests/${request._id}`)} onEdit={(request) => navigate(`/workspace/requests/edit/${request._id}`)} />} />
                    <Route path="/spotlight" element={<SpotlightSection />} />
                    <Route path="/trending" element={<TrendingSection />} />
                    <Route path="/ai-agent-tools" element={<AIAgentToolsSection />} />
                    <Route
                        path="/requests/new"
                        element={<RequestForm onSubmit={handleRequestCreate} onCancel={() => navigate('/workspace/explore')} />}
                    />
                    <Route
                        path="/requests/edit/:id"
                        element={<EditRequestForm requests={requests} onSubmit={handleRequestUpdate} />}
                    />
                    <Route
                        path="/requests/:id"
                        element={<RequestDetails requests={requests} response={response} onSend={handleRequestSend} />}
                    />
                </Routes>
            </div>
        </div>
    );
};

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
            <button className='edit-request-button' onClick={() => navigate(`/workspace/requests/edit/${request._id}`)}>Edit</button>
            {response && <ResponseDisplay response={response} />}

        </>
    );
};

const EditRequestForm = ({ requests, onSubmit }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Loading..</div>
    }

    return (
        <RequestForm initialValues={request} onSubmit={onSubmit} onCancel={() => navigate(`/workspace/requests/${id}`)} />
    )
}

export default Workspace;