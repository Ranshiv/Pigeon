import React from 'react';
import NetworkFlowRenderer from './NetworkFlowRenderer';

const NetworkFlowHost = ({ url, method, headers, bodyContent, networkFlowData, setNetworkFlowData }) => {
    return (
        <NetworkFlowRenderer
            options={{
                requestUrl: url,
                requestMethod: method,
                headers: headers,
                requestBody: bodyContent
            }}
            onNodeSelect={(node) => console.log('Selected node:', node)}
            onEdgeSelect={(edge) => console.log('Selected edge:', edge)}
        />
    );
};

export default NetworkFlowHost;
