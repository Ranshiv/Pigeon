// client/src/App.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'; // Import useParams
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import ResponseDisplay from './components/ResponseDisplay';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import './App.css';

function App() {
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
        navigate(`/requests/${savedRequest._id}`);
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
        navigate(`/requests/${updatedRequest._id}`);
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
        navigate('/');
      } else {
        const errorData = await res.json();
        console.error('Failed to delete', errorData);
      }
    } catch (err) {
      console.error('Error deleting request:', err);
    }
  };

  return (
    <div className="App">
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<Home onGetStarted={() => navigate('/requests')} />} />
          <Route
            path="/requests"
            element={
              <>
                <div className="left-panel">
                  <RequestList
                    requests={requests}
                    onSelect={(request) => navigate(`/requests/${request._id}`)}
                    onSend={handleRequestSend}
                    onDelete={handleRequestDelete}
                    onEdit={(request) => navigate(`/requests/edit/${request._id}`)}
                  />
                  <button
                    className="add-request-button"
                    onClick={() => navigate('/requests/new')}
                  >
                    Add Request
                  </button>
                </div>
                <div className="right-panel">
                  {/* Placeholder - This area won't be used directly */}
                </div>
              </>
            }
          />
          <Route
            path="/requests/new"
            element={
              <>
                <div className="left-panel">
                  <RequestList
                    requests={requests}
                    onSelect={(request) => navigate(`/requests/${request._id}`)}
                    onSend={handleRequestSend}
                    onDelete={handleRequestDelete}
                    onEdit={(request) => navigate(`/requests/edit/${request._id}`)}
                  />
                  <button
                    className="add-request-button"
                    onClick={() => navigate('/requests/new')}
                  >
                    Add Request
                  </button>
                </div>
                <div className="right-panel">
                  <RequestForm onSubmit={handleRequestCreate} onCancel={() => navigate('/requests')} />
                </div>
              </>
            }
          />
          <Route
            path="/requests/edit/:id"
            element={
              <>
                <div className="left-panel">
                  <RequestList
                    requests={requests}
                    onSelect={(request) => navigate(`/requests/${request._id}`)}
                    onSend={handleRequestSend}
                    onDelete={handleRequestDelete}
                    onEdit={(request) => navigate(`/requests/edit/${request._id}`)}
                  />
                  <button
                    className="add-request-button"
                    onClick={() => navigate('/requests/new')}
                  >
                    Add Request
                  </button>
                </div>
                <div className="right-panel">
                  <EditRequestForm requests={requests} onSubmit={handleRequestUpdate} />
                </div>
              </>
            }
          />

          <Route
            path="/requests/:id"
            element={
              <>
                <div className="left-panel">
                  <RequestList
                    requests={requests}
                    onSelect={(request) => navigate(`/requests/${request._id}`)}
                    onSend={handleRequestSend}
                    onDelete={handleRequestDelete}
                    onEdit={(request) => navigate(`/requests/edit/${request._id}`)}
                  />
                  <button
                    className="add-request-button"
                    onClick={() => navigate('/requests/new')}
                  >
                    Add Request
                  </button>
                </div>
                <div className="right-panel">
                  <RequestDetails requests={requests} response={response} onSend={handleRequestSend} />
                </div>
              </>
            }
          />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

const RequestDetails = ({ requests, response, onSend }) => {
  const { id } = useParams();
  const request = requests.find((r) => r._id === id);

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
    <RequestForm initialValues={request} onSubmit={onSubmit} onCancel={() => navigate(`/requests/${id}`)} />
  )
}
export default App;