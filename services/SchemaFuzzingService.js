// Deterministic schema-driven case generation.  This module has no I/O so it
// can be shared by the preview API and unit tests.
const { buildSchema, parse, getOperationAST, typeFromAST, isInputObjectType, isNonNullType, isListType, getNamedType } = require('graphql');

const clone = (value) => JSON.parse(JSON.stringify(value));
const pointer = (ref) => String(ref || '').replace(/^#\//, '').split('/').map(decodeURIComponent);
const resolveRef = (spec, value) => {
    let current = value;
    const seen = new Set();
    while (current?.$ref?.startsWith('#/') && !seen.has(current.$ref)) {
        seen.add(current.$ref);
        current = pointer(current.$ref).reduce((node, key) => node?.[key], spec);
    }
    return current || {};
};
const sample = (spec, schema, depth = 0) => {
    schema = resolveRef(spec, schema);
    if (schema.example !== undefined) return clone(schema.example);
    if (schema.default !== undefined) return clone(schema.default);
    if (schema.enum?.length) return clone(schema.enum[0]);
    if (depth > 4) return {};
    if (schema.type === 'array') return [sample(spec, schema.items || {}, depth + 1)];
    if (schema.type === 'object' || schema.properties) return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, child]) => [key, sample(spec, child, depth + 1)]));
    if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 1;
    if (schema.type === 'boolean') return true;
    if (schema.format === 'email') return 'fuzz@example.invalid';
    if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
    return 'pigeon-fuzz';
};
const caseOf = (category, name, mutation, overrides) => ({ id: `${category}-${name}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(), category, name, mutation, overrides });

function buildOpenApiCases(spec, path, method) {
    const operation = resolveRef(spec, spec?.paths?.[path]?.[String(method).toLowerCase()]);
    if (!operation || !Object.keys(operation).length) throw new Error('OpenAPI operation was not found.');
    const swaggerBody = (operation.parameters || []).find((parameter) => parameter?.in === 'body')?.schema;
    const schema = resolveRef(spec, Object.values(operation.requestBody?.content || {})[0]?.schema || swaggerBody);
    const baseline = sample(spec, schema);
    const hasBody = Boolean(Object.keys(schema || {}).length);
    const cases = [caseOf('baseline', 'Baseline', hasBody ? 'Schema-valid request body' : 'Schema-valid parameters', hasBody ? { body: baseline } : {})];
    const walk = (node, value, pathParts = []) => {
        node = resolveRef(spec, node);
        if (!node || !value || typeof value !== 'object' || Array.isArray(value)) return;
        for (const [key, childRaw] of Object.entries(node.properties || {})) {
            const child = resolveRef(spec, childRaw); const next = [...pathParts, key];
            if ((node.required || []).includes(key)) { const body = clone(baseline); let target = body; pathParts.forEach((part) => { target = target[part]; }); delete target[key]; cases.push(caseOf('required', `Missing ${next.join('.')}`, 'Removed required field', { body })); }
            if (child.enum?.length) { const body = clone(baseline); let target = body; pathParts.forEach((part) => { target = target[part]; }); target[key] = '__pigeon_invalid_enum__'; cases.push(caseOf('enum', `Invalid ${next.join('.')}`, 'Value outside enum', { body })); }
            if (child.type === 'string') { const body = clone(baseline); let target = body; pathParts.forEach((part) => { target = target[part]; }); target[key] = 42; cases.push(caseOf('type', `Wrong type ${next.join('.')}`, 'String replaced with number', { body })); if (child.minLength) { const short = clone(baseline); let t = short; pathParts.forEach((part) => { t = t[part]; }); t[key] = ''; cases.push(caseOf('boundary', `Too short ${next.join('.')}`, 'Below minLength', { body: short })); } }
            if (['number', 'integer'].includes(child.type)) { const body = clone(baseline); let target = body; pathParts.forEach((part) => { target = target[part]; }); target[key] = 'not-a-number'; cases.push(caseOf('type', `Wrong type ${next.join('.')}`, 'Number replaced with string', { body })); if (child.minimum !== undefined) { const low = clone(baseline); let t = low; pathParts.forEach((part) => { t = t[part]; }); t[key] = child.minimum - 1; cases.push(caseOf('boundary', `Below minimum ${next.join('.')}`, 'Below minimum', { body: low })); } }
            if (child.type === 'object' || child.properties) walk(child, value[key], next);
        }
    };
    walk(schema, baseline);
    if (schema.additionalProperties === false && baseline && typeof baseline === 'object') { const body = clone(baseline); body.__pigeonFuzzProbe = 'unexpected-property'; cases.push(caseOf('additional-property', 'Unexpected property', 'Added property prohibited by schema', { body })); }
    const parameters = [...(spec?.paths?.[path]?.parameters || []), ...(operation.parameters || [])].map((parameter) => resolveRef(spec, parameter)).filter((parameter) => parameter?.name && ['query', 'path', 'header'].includes(parameter.in));
    const baselineParams = parameters.map((parameter) => ({ key: parameter.name, name: parameter.name, value: String(sample(spec, parameter.schema || parameter)), enabled: true }));
    if (parameters.length) {
        cases[0].overrides.params = baselineParams;
        parameters.forEach((parameter) => {
            const schemaForParameter = resolveRef(spec, parameter.schema || parameter);
            if (parameter.required) { const params = baselineParams.filter((item) => item.key !== parameter.name); cases.push(caseOf('required', `Missing ${parameter.in} ${parameter.name}`, 'Removed required parameter', { params })); }
            const params = clone(baselineParams); const target = params.find((item) => item.key === parameter.name); if (target) { target.value = schemaForParameter.type === 'string' ? '42' : 'not-a-number'; cases.push(caseOf('type', `Wrong type ${parameter.in} ${parameter.name}`, 'Invalid parameter type', { params })); }
        });
    }
    return cases;
}

function buildGraphQlCases(schemaSDL, query, variables = {}) {
    const schema = buildSchema(schemaSDL); const operation = getOperationAST(parse(query));
    if (!operation) throw new Error('GraphQL query must contain an operation.');
    const baseline = clone(variables || {}); const cases = [caseOf('baseline', 'Baseline', 'Original GraphQL variables', { variables: baseline })];
    for (const definition of operation.variableDefinitions || []) {
        const name = definition.variable.name.value; const type = typeFromAST(schema, definition.type); const baseType = getNamedType(type);
        if (isNonNullType(type)) { const next = clone(baseline); delete next[name]; cases.push(caseOf('required', `Missing $${name}`, 'Removed required variable', { variables: next })); }
        const wrong = clone(baseline); wrong[name] = baseType.name === 'String' ? 42 : 'pigeon-invalid'; cases.push(caseOf('type', `Wrong type $${name}`, 'Invalid variable type', { variables: wrong }));
        if (isInputObjectType(baseType)) for (const [fieldName, field] of Object.entries(baseType.getFields())) if (isNonNullType(field.type) && baseline[name] && typeof baseline[name] === 'object') { const next = clone(baseline); delete next[name][fieldName]; cases.push(caseOf('required', `Missing $${name}.${fieldName}`, 'Removed required input field', { variables: next })); }
        if (isListType(type) || isListType(type?.ofType)) { const next = clone(baseline); next[name] = 'not-an-array'; cases.push(caseOf('type', `Wrong list $${name}`, 'Array replaced with scalar', { variables: next })); }
    }
    return cases;
}

module.exports = { buildOpenApiCases, buildGraphQlCases, resolveRef, sample };
