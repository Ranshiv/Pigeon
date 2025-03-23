// client/src/components/Workspace.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import TrendingSection from './TrendingSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestForm from './RequestForm';
import ResponseDisplay from './ResponseDisplay';
import Home from './Home'; // Corrected import: Use Home, not HomeSection
import WorkspacesSection from './WorkspacesSection';
import APINetworkSection from './APINetworkSection';
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
            navigate(`/workspace/workspaces/requests/${request._id}`);
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
                navigate(`/workspace/workspaces/requests/${savedRequest._id}`);
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
                navigate(`/workspace/workspaces/requests/${updatedRequest._id}`);
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
                navigate('/workspace/workspaces/explore');
            } else {
                const errorData = await res.json();
                console.error('Failed to delete', errorData);
            }
        } catch (err) {
            console.error('Error deleting request:', err);
        }
    };

    return (
        <Routes>
            {/* Redirect /workspace to /workspace/home */}
            <Route index element={<Navigate to="/workspace/home" />} />
            <Route path="home" element={<Home />} /> {/* Use Home component */}
            <Route path="workspaces/*" element={<WorkspacesSection requests={requests} response={response} onSend={handleRequestSend} onUpdate={handleRequestUpdate} onDelete={handleRequestDelete} />} />
            <Route path="api-network/*" element={<APINetworkSection />} />
        </Routes>
    );
};

export default Workspace;