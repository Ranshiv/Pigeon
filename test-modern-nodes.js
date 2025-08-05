import React from 'react';
import EndpointNode from '../client/src/components/VisualApiDesigner/components/EndpointNode';
import SchemaNode from '../client/src/components/VisualApiDesigner/components/SchemaNode';
import ResourceNode from '../client/src/components/VisualApiDesigner/components/ResourceNode';

// Simple test to validate components
const NodeTest = () => {
    const mockData = {
        endpoint: {
            method: 'GET',
            path: '/api/users',
            name: 'Get Users',
            description: 'Retrieve list of users'
        },
        schema: {
            type: 'object',
            name: 'User Schema',
            description: 'User data structure'
        },
        resource: {
            name: 'Users Resource',
            description: 'User management resource'
        }
    };

    return (
        <div style={{ padding: '20px', background: '#1a1a1a', minHeight: '100vh' }}>
            <h1 style={{ color: 'white', marginBottom: '20px' }}>Modern Node Components Test</h1>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ width: '300px' }}>
                    <h3 style={{ color: 'white' }}>Endpoint Node</h3>
                    <EndpointNode
                        id="test-endpoint"
                        data={mockData.endpoint}
                        selected={false}
                        onSelect={() => console.log('Endpoint selected')}
                        onUpdate={() => console.log('Endpoint updated')}
                        onDelete={() => console.log('Endpoint deleted')}
                    />
                </div>

                <div style={{ width: '300px' }}>
                    <h3 style={{ color: 'white' }}>Schema Node</h3>
                    <SchemaNode
                        id="test-schema"
                        data={mockData.schema}
                        selected={false}
                        onSelect={() => console.log('Schema selected')}
                        onUpdate={() => console.log('Schema updated')}
                        onDelete={() => console.log('Schema deleted')}
                    />
                </div>

                <div style={{ width: '300px' }}>
                    <h3 style={{ color: 'white' }}>Resource Node</h3>
                    <ResourceNode
                        id="test-resource"
                        data={mockData.resource}
                        selected={false}
                        onSelect={() => console.log('Resource selected')}
                        onUpdate={() => console.log('Resource updated')}
                        onDelete={() => console.log('Resource deleted')}
                    />
                </div>
            </div>
        </div>
    );
};

export default NodeTest;
