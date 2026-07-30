const { randomUUID } = require('crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestContext(req, res, next) {
    const incomingId = req.get('x-request-id');
    const requestId = incomingId && REQUEST_ID_PATTERN.test(incomingId) ? incomingId : randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

module.exports = { requestContext, REQUEST_ID_PATTERN };
