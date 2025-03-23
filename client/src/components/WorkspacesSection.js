//client/src/components/WorkspacesSection.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom'; // Import useParams
import ExploreSection from './ExploreSection';
import SpotlightSection from './SpotlightSection';
import TrendingSection from './TrendingSection';
import AIAgentToolsSection from './AIAgentToolsSection';
import RequestForm from './RequestForm'; // Import RequestForm
import ResponseDisplay from './ResponseDisplay'; // Import ResponseDisplay
import './WorkspacesSection.css';

const WorkspacesSection = ({ requests, response, onSend, onUpdate, onDelete }) => {
    const navigate = useNavigate();
    return (
        <div className="workspaces-section">
            <div className="workspace-sidebar">
                <div onClick={() => navigate('explore')}>Explore</div>
                <div onClick={() => navigate('spotlight')}>Spotlight</div>
                <div onClick={() => navigate('trending')}>Trending</div>
                <div onClick={() => navigate('ai-agent-tools')}>AI Agent Tools</div>
                <div onClick={() => navigate('requests/new')}>Add Request</div>
            </div>
            <div className="workspace-main-content">
                <Routes>
                    <Route index element={<Navigate to="explore" />} />
                    <Route path="explore" element={<ExploreSection requests={requests} onSend={onSend} onDelete={onDelete} onSelect={(request) => navigate(`requests/${request._id}`)} onEdit={(request) => navigate(`requests/edit/${request._id}`)} />} />
                    <Route path="spotlight" element={<SpotlightSection />} />
                    <Route path="trending" element={<TrendingSection />} />
                    <Route path="ai-agent-tools" element={<AIAgentToolsSection />} />
                    <Route
                        path="requests/new"
                        element={<RequestForm onSubmit={onSend} onCancel={() => navigate('explore')} />}
                    />
                    <Route
                        path="requests/edit/:id"
                        element={<EditRequestForm requests={requests} onSubmit={onUpdate} />}
                    />
                    <Route
                        path="requests/:id"
                        element={<RequestDetails requests={requests} response={response} onSend={onSend} />}
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
            <button className='edit-request-button' onClick={() => navigate(`requests/edit/${request._id}`)}>Edit</button>
            {response && <ResponseDisplay response={response} />}

        </>
    );
};

const EditRequestForm = ({ requests, onSubmit }) => {
    const { id } = useParams();
    const request = requests.find((r) => r._id === id);
    const navigate = useNavigate();

    if (!request) {
        return <div>Loading..</div>;
    }

    return (
        <RequestForm initialValues={request} onSubmit={onSubmit} onCancel={() => navigate(`requests/${id}`)} />
    )
}

export default WorkspacesSection;