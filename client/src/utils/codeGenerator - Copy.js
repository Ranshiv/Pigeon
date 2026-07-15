export const generateCodeSnippet = (language, request) => {
    const { method, url, headers, body, queryParams } = request;

    // Append query params to URL if provided
    let fullUrl = url;
    if (queryParams && Object.keys(queryParams).length > 0) {
        const queryString = new URLSearchParams(queryParams).toString();
        if (queryString) {
            fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
        }
    }

    switch (language) {
        case 'curl':
            return generateCurl(method, fullUrl, headers, body);
        case 'javascript':
            return generateFetch(method, fullUrl, headers, body);
        case 'axios':
            return generateAxios(method, fullUrl, headers, body);
        case 'python':
            return generatePythonRequests(method, fullUrl, headers, body);
        default:
            return '';
    }
};

const generateCurl = (method, url, headers, body) => {
    let snippet = `curl -X ${method} "${url}"`;

    if (Object.keys(headers).length > 0) {
        Object.entries(headers).forEach(([key, value]) => {
            snippet += ` \\\n  -H "${key}: ${value}"`;
        });
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        // Escape single quotes for shell safety usually, but keeping simple for now
        // If JSON, use -d '...'
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        snippet += ` \\\n  -d '${bodyStr}'`;
    }

    return snippet;
};

const generateFetch = (method, url, headers, body) => {
    const options = {
        method: method,
        headers: headers
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = typeof body === 'object' ? body : JSON.parse(body || '{}');
    }

    // Pretty print options
    // We need to handle body specifically to not print "body": [object Object] depending on how we construct
    // But JSON.stringify(options) handles it well if body is an object.

    // However, usually developers want body: JSON.stringify(...) in the code.
    let optionsStr = `const options = {\n  method: '${method}',\n  headers: ${JSON.stringify(headers, null, 4).replace(/^/gm, '  ')}`;

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        optionsStr += `,\n  body: JSON.stringify(${typeof body === 'string' ? body : JSON.stringify(body, null, 4)})`;
    }
    optionsStr += '\n};\n\n';

    return `${optionsStr}fetch('${url}', options)\n  .then(response => response.json())\n  .then(response => console.log(response))\n  .catch(err => console.error(err));`;
};

const generateAxios = (method, url, headers, body) => {
    let snippet = `import axios from 'axios';\n\n`;

    const config = {
        method: method.toLowerCase(),
        url: url,
        headers: headers
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.data = typeof body === 'string' ? JSON.parse(body) : body;
    }

    snippet += `const options = ${JSON.stringify(config, null, 2)};\n\n`;
    snippet += `axios.request(options).then(function (response) {\n  console.log(response.data);\n}).catch(function (error) {\n  console.error(error);\n});`;

    return snippet;
};

const generatePythonRequests = (method, url, headers, body) => {
    let snippet = `import requests\nimport json\n\n`;
    snippet += `url = "${url}"\n\n`;

    if (Object.keys(headers).length > 0) {
        snippet += `payload = {}\n`; // Placeholder if needed? No, payload usually refers to body
        snippet += `headers = ${JSON.stringify(headers, null, 2).replace(/true/g, 'True').replace(/false/g, 'False')}\n\n`;
    } else {
        snippet += `headers = {}\n\n`;
    }

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
        snippet += `payload = json.dumps(${bodyStr})\n\n`;
        snippet += `response = requests.request("${method}", url, headers=headers, data=payload)\n\n`;
    } else {
        snippet += `response = requests.request("${method}", url, headers=headers)\n\n`;
    }

    snippet += `print(response.text)`;
    return snippet;
};
