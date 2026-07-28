const escapeTableValue = (value = '') => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();

const formatBodyExample = (request) => {
    if (!request.body) return '';
    const language = request.bodyType === 'json' || request.bodyType === 'graphql' ? 'json' : 'text';
    return `\n#### Request body\n\n\`\`\`${language}\n${request.body}\n\`\`\``;
};

const formatRequest = (request) => {
    const name = request.name || `${request.method || 'HTTP'} endpoint`;
    const method = String(request.method || 'GET').toUpperCase();
    const url = request.url || '/';
    const description = request.description || 'Add a description for this endpoint.';
    const params = (request.params || []).filter((item) => item?.enabled !== false && (item.name || item.key));
    const headers = (request.headers || []).filter((item) => item?.enabled !== false && (item.name || item.key));
    const parameterRows = params.length
        ? params.map((item) => `| ${escapeTableValue(item.name || item.key)} | query | ${escapeTableValue(item.description || 'Describe this parameter')} |`).join('\n')
        : '| — | — | No parameters defined |';
    const headerRows = headers.length
        ? headers.map((item) => `| ${escapeTableValue(item.name || item.key)} | ${escapeTableValue(item.description || 'Request header')} |`).join('\n')
        : '| — | No headers defined |';

    return `### ${name}\n\n> **${method}** \`${url}\`\n\n${description}\n\n#### Parameters\n\n| Name | Location | Description |\n| --- | --- | --- |\n${parameterRows}\n\n#### Headers\n\n| Name | Description |\n| --- | --- |\n${headerRows}${formatBodyExample(request)}\n\n#### Example response\n\n\`\`\`json\n{\n  "success": true\n}\n\`\`\``;
};

export const buildApiReference = (collection) => {
    const requests = Array.isArray(collection?.requests) ? collection.requests : [];
    if (!requests.length) return '';
    const title = collection.name || 'API';
    const sections = requests
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(formatRequest)
        .join('\n\n');
    return `## API reference\n\nGenerated from the requests in **${title}**. Review descriptions and examples before publishing.\n\n${sections}\n`;
};

export const buildEndpointReference = (request) => formatRequest(request);
