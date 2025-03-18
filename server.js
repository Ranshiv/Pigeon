// server.js (Complete - including previous code)
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); //For node-fetch
const Request = require('./models/Request'); // Import the Request model

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// --- API Endpoints ---

// Create a new request
app.post('/api/requests', async (req, res) => {
    try {
        const newRequest = new Request(req.body);
        const savedRequest = await newRequest.save();
        res.status(201).json(savedRequest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get a specific request by ID
app.get('/api/requests/:id', async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json(request);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a specific request by ID
app.put('/api/requests/:id', async (req, res) => {
    try {
        const updatedRequest = await Request.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedRequest) {
            return res.status(404).json({ message: 'updated Request not found' });
        }
        res.json(updatedRequest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a specific request by ID
app.delete('/api/requests/:id', async (req, res) => {
    try {
        const deletedRequest = await Request.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
    try {
        const requests = await Request.find();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Send the request and get the response
app.post('/api/requests/:id/send', async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const { url, method, headers, body, bodyType } = request;

        const fetchOptions = {
            method,
            headers: headers.reduce((acc, { name, value }) => {
                acc[name] = value;
                return acc;
            }, {}),
        };

        if (body && bodyType !== 'none') {
            if (bodyType === 'json') {
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(JSON.parse(body)); // Parse and stringify to ensure valid JSON
            } else if (bodyType === 'x-www-form-urlencoded') {
                fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                const encodedBody = new URLSearchParams(JSON.parse(body)).toString();
                fetchOptions.body = encodedBody;

            }
            else {
                // For 'raw' or other types, send the body as is (assuming it's a string)
                fetchOptions.body = body;
            }
        }

        const response = await fetch(url, fetchOptions);

        const responseHeaders = {};
        response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
        });

        const responseBody = await response.text();
        let parsedResponseBody;
        try {
            parsedResponseBody = JSON.parse(responseBody)
        } catch (error) {
            parsedResponseBody = responseBody
        }

        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: parsedResponseBody,
        });

    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json({ message: 'Error sending request', error: err.message });
    }
});

// Basic API endpoint (keep for testing)
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend connected!' });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});