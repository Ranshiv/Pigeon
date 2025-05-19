// routes/requests.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Request = require('../models/Request');
const History = require('../models/History');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { executePreRequestScript, executeTestScript } = require('../utils/scriptRunner');

// Store for user environments
const userEnvironments = {};

// Create a new request
router.post('/', async (req, res) => {
    try {
        const newRequest = new Request(req.body);
        const savedRequest = await newRequest.save();
        res.status(201).json(savedRequest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get a specific request by ID
router.get('/:id', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
router.get('/', async (req, res) => {
    try {
        const requests = await Request.find();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Send the request and get the response
router.post('/:id/send', ensureAuthenticated, async (req, res) => {
    const startTime = Date.now();
    let responseStatus, responseStatusText, responseHeadersObj, responseBodyText, responseSize, isJson = false;
    let testResults = [];

    // Get or initialize user's environment store
    const userId = req.user.id;
    if (!userEnvironments[userId]) {
        userEnvironments[userId] = {};
    }
    const userEnv = userEnvironments[userId];

    try {
        // Check if the ID is a valid MongoDB ObjectId
        const isValidObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
        let requestDoc = null;

        if (isValidObjectId) {
            // Only try to find in the database if the ID is a valid MongoDB ObjectId
            try {
                requestDoc = await Request.findById(req.params.id);
            } catch (err) {
                console.log(`Error finding request by ID: ${err.message}, will use request data from body instead`);
            }
        }

        // If not found in Request model or ID isn't a valid ObjectId, it must be a request from a collection
        if (!requestDoc) {
            console.log(`Request ${req.params.id} not found in Request model, checking request data in body...`);
            // Use the request data from the body instead
            const requestData = req.body;

            if (!requestData || !requestData.url) {
                return res.status(404).json({ message: 'Request not found and no valid request data provided in body' });
            }

            // Create a compatible request object from the provided data
            requestDoc = {
                _id: req.params.id,
                url: requestData.url,
                method: requestData.method || 'GET',
                headers: requestData.headers || [],
                body: requestData.body || '',
                bodyType: requestData.bodyType || 'none',
                preRequestScript: requestData.preRequestScript || '',
                testScript: requestData.testScript || ''
            };
            console.log(`Using request data from body: ${requestDoc.method} ${requestDoc.url}`);
        }

        const { url, method, headers, body, bodyType, preRequestScript, testScript } = requestDoc;

        // --- Prepare and Send Fetch Request ---
        const fetchOptions = {
            method,
            headers: headers.reduce((acc, { name, value }) => {
                if (name && value) acc[name] = value; // Avoid adding empty headers
                return acc;
            }, {}),
            timeout: 30000, // Example: 30 second timeout
        };

        if (body && bodyType !== 'none') {
            // Set Content-Type based on bodyType if not already set
            let contentTypeHeader = Object.keys(fetchOptions.headers).find(h => h.toLowerCase() === 'content-type');
            if (!contentTypeHeader) {
                if (bodyType === 'json') contentTypeHeader = 'application/json';
                else if (bodyType === 'x-www-form-urlencoded') contentTypeHeader = 'application/x-www-form-urlencoded';
                // Add other types if needed (e.g., text/plain)
                if (contentTypeHeader) fetchOptions.headers['Content-Type'] = contentTypeHeader;
            }

            if (bodyType === 'json') {
                // Ensure body is valid JSON string before sending
                try {
                    JSON.parse(body); // Validate
                    fetchOptions.body = body;
                } catch (parseError) {
                    throw new Error("Invalid JSON in request body");
                }
            } else if (bodyType === 'x-www-form-urlencoded') {
                try {
                    const parsedBody = JSON.parse(body); // Assume body is stored as JSON string for key-value pairs
                    fetchOptions.body = new URLSearchParams(parsedBody).toString();
                } catch (parseError) {
                    throw new Error("Invalid key-value format for x-www-form-urlencoded body (expected JSON string)");
                }
            } else { // raw, text, etc.
                fetchOptions.body = body;
            }
        }

        // --- Execute Pre-request Script with user environment ---
        let requestWithScriptChanges = { url, ...fetchOptions };
        let updatedEnv = { ...userEnv };

        if (preRequestScript) {
            console.log("Executing pre-request script...");
            const preRequestResult = executePreRequestScript(preRequestScript, requestWithScriptChanges, userEnv);

            if (preRequestResult.error) {
                console.error("Pre-request script error:", preRequestResult.error);
                // Continue with request, but log the error
            } else {
                // Apply any changes from the pre-request script
                requestWithScriptChanges = preRequestResult.request;
                updatedEnv = preRequestResult.environment;

                // Update environment
                userEnvironments[userId] = updatedEnv;
                console.log("Updated environment after pre-request script:", Object.keys(updatedEnv));

                // Update request options based on pre-request script changes
                fetchOptions.headers = requestWithScriptChanges.headers || fetchOptions.headers;
                fetchOptions.body = requestWithScriptChanges.body || fetchOptions.body;

                // Handle variables set by pre-request script
                if (requestWithScriptChanges.variables && requestWithScriptChanges.variables.values) {
                    // Apply variables to URL
                    let modifiedUrl = url;
                    for (const [key, value] of Object.entries(requestWithScriptChanges.variables.values)) {
                        const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                        modifiedUrl = modifiedUrl.replace(pattern, value);
                    }
                    // Use the modified URL
                    requestWithScriptChanges.url = modifiedUrl;
                }
            }
        }

        const externalResponse = await fetch(requestWithScriptChanges.url || url, fetchOptions);
        const duration = Date.now() - startTime;

        // --- Process Response ---
        responseStatus = externalResponse.status;
        responseStatusText = externalResponse.statusText;
        responseHeadersObj = {};
        externalResponse.headers.forEach((value, name) => {
            responseHeadersObj[name] = value;
        });
        responseBodyText = await externalResponse.text();
        responseSize = Buffer.byteLength(responseBodyText, 'utf8'); // Approximate size

        let parsedResponseBody = responseBodyText;
        const contentType = responseHeadersObj['content-type']?.toLowerCase() || '';
        if (contentType.includes('application/json')) {
            try {
                parsedResponseBody = JSON.parse(responseBodyText);
                isJson = true;
            } catch (e) {
                console.warn("Failed to parse JSON response body");
                isJson = false; // Treat as text if parsing fails
            }
        }

        // --- Execute Test Script with user environment ---
        if (testScript) {
            console.log("Executing test script...");
            const responseForTesting = {
                status: responseStatus,
                statusText: responseStatusText,
                headers: responseHeadersObj,
                body: parsedResponseBody,
                duration: duration,
                size: responseSize
            };

            const testScriptResult = executeTestScript(testScript, responseForTesting, userEnv);

            if (testScriptResult.error) {
                console.error("Test script error:", testScriptResult.error);
                // Add the error as a test result
                testResults = [{
                    name: "Test Script Error",
                    passed: false,
                    error: testScriptResult.error.message,
                    timestamp: Date.now()
                }];
            } else {
                testResults = testScriptResult.results || [];
                // Update environment after test script
                userEnvironments[userId] = testScriptResult.environment;
                console.log("Updated environment after test script:", Object.keys(testScriptResult.environment));
            }
        }

        // --- Send Response to Frontend ---
        const frontendResponse = {
            status: responseStatus,
            statusText: responseStatusText,
            headers: responseHeadersObj,
            body: parsedResponseBody,
            isJson: isJson, // Send flag to frontend
            duration: duration,
            size: responseSize,
            testResults: testResults.length > 0 ? testResults : null
        };

        res.json(frontendResponse);

        // --- Save History (After Sending Response) ---
        try {
            const historyEntry = new History({
                userId: req.user.id, // Associate with logged-in user
                url: requestWithScriptChanges.url || url,
                method: method,
                requestHeaders: JSON.stringify(fetchOptions.headers), // Store headers used
                requestBody: fetchOptions.body || '', // Store body sent
                requestBodyType: bodyType,
                responseStatus: responseStatus,
                responseStatusText: responseStatusText,
                responseHeaders: JSON.stringify(responseHeadersObj),
                responseBody: responseBodyText, // Store raw text body
                isJson: isJson,
                timestamp: new Date(startTime), // Use the start time
                duration: duration,
                size: responseSize,
                originalRequestId: requestDoc._id, // This could be a string ID or ObjectId
                // Add collection info if available
                collectionId: req.body.collectionId || null,
                collectionRequestId: req.body.requestId || requestDoc._id,
                // Save test results if available
                testResults: testResults.length > 0 ? JSON.stringify(testResults) : null
            });
            await historyEntry.save();
            console.log("History entry saved for request ID:", requestDoc._id);
        } catch (historyError) {
            console.error("Error saving history entry:", historyError);
            // Log the error, but don't fail the main request
        }

    } catch (err) {
        const duration = Date.now() - startTime;
        console.error("Error during external fetch or processing:", err);
        // Send an error response to the frontend
        res.status(500).json({
            error: `Error sending request: ${err.message}`, // Send error message
            status: 500, // Indicate server-side error during send
            statusText: 'Server Error',
            headers: {},
            body: null,
            duration: duration,
            testResults: null
        });

        // --- Optionally save failed attempt to History ---
        try {
            const historyEntry = new History({
                userId: req.user.id,
                url: req.params.id ? (await Request.findById(req.params.id))?.url || 'Unknown URL' : 'Unknown URL', // Attempt to get URL
                method: req.params.id ? (await Request.findById(req.params.id))?.method || 'Unknown Method' : 'Unknown Method', // Attempt to get method
                responseStatus: 500, // Indicate internal error
                responseStatusText: 'Server Error During Send',
                responseBody: `Error: ${err.message}`,
                timestamp: new Date(startTime),
                duration: duration,
                originalRequestId: req.params.id || null
            });
            await historyEntry.save();
            console.log("Failed history entry saved for request ID:", req.params.id);
        } catch (failedHistoryError) {
            console.error("Error saving FAILED history entry:", failedHistoryError);
        }
    }
});

// Get request history
router.get('/history', ensureAuthenticated, async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.id })
            .sort({ timestamp: -1 }) // Sort by newest first
            .limit(50); // Limit to latest 50 entries (for now)

        // Parse test results JSON strings into objects for the frontend
        const historyWithParsedTests = history.map(entry => {
            const historyObj = entry.toObject();
            if (historyObj.testResults && typeof historyObj.testResults === 'string') {
                try {
                    historyObj.testResults = JSON.parse(historyObj.testResults);
                } catch (err) {
                    console.error("Error parsing test results for history entry:", err);
                    historyObj.testResults = null;
                }
            }
            return historyObj;
        });

        res.json(historyWithParsedTests);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ message: 'Error fetching history', error: err.message });
    }
});

module.exports = router;