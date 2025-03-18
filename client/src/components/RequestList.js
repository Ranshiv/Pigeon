// client/src/components/RequestList.js
import React from 'react';
import './RequestList.css'

const RequestList = ({ requests, onSelect, onSend, onDelete, onEdit }) => {
    return (
        <div className="request-list">
            <h2>Requests</h2>
            <ul>
                {requests.map((request) => (
                    <li key={request._id} onClick={() => onSelect(request)} className="request-item">
                        {request.name}
                        <div className='button-group'>
                            <button onClick={(e) => { e.stopPropagation(); onSend(request); }}>Send</button>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(request) }}>Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(request._id); }}>Delete</button>
                        </div>

                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RequestList;