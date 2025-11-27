/**
 * ProtocolTestPage.js - Multi-Protocol Testing Hub
 * Unified interface for testing WebSocket, gRPC, SOAP, MQTT, SSE protocols
 */

import React, { useState } from 'react';
import {
    ProtocolSelector,
    ProtocolIcon,
    WebSocketTester,
    GrpcTester,
    MqttTester,
    SoapTester,
    SseTester,
    ProtocolConverterUI,
    PROTOCOLS
} from './Protocols';
import GraphQLTester from './GraphQL/GraphQLTester';
import './ProtocolTestPage.css';

// Header Icon Component
const HeaderIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l6-6-6-6" />
        <path d="M20 7l-6 6 6 6" />
        <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
);

const ProtocolTestPage = () => {
    const [selectedProtocol, setSelectedProtocol] = useState(null);
    const [activeTab, setActiveTab] = useState('tester'); // 'tester' or 'converter'

    const renderProtocolTester = () => {
        switch (selectedProtocol) {
            case 'websocket':
                return <WebSocketTester initialUrl="wss://echo.websocket.org" />;
            case 'grpc':
                return <GrpcTester showSampleProto={true} />;
            case 'graphql':
                return <GraphQLTester />;
            case 'mqtt':
                return <MqttTester initialBroker="wss://broker.emqx.io:8084/mqtt" />;
            case 'soap':
                return <SoapTester initialWsdlUrl="http://www.dneonline.com/calculator.asmx?wsdl" />;
            case 'sse':
                return <SseTester initialUrl="http://localhost:5001/api/protocols/sse/demo" />;
            default:
                return (
                    <div className="protocol-welcome">
                        <div className="welcome-icon">
                            <HeaderIcon />
                        </div>
                        <h2>Select a Protocol to Begin Testing</h2>
                        <p>Choose from the protocols above to start testing your APIs</p>

                        <div className="protocol-cards">
                            {Object.values(PROTOCOLS).filter(p => p.id !== 'http' && p.id !== 'graphql').map(protocol => (
                                <div
                                    key={protocol.id}
                                    className="protocol-card"
                                    onClick={() => setSelectedProtocol(protocol.id)}
                                    style={{ '--protocol-color': protocol.color }}
                                >
                                    <span className="card-icon">
                                        <ProtocolIcon type={protocol.icon} size={28} color={protocol.color} />
                                    </span>
                                    <h3>{protocol.name}</h3>
                                    <p>{protocol.description}</p>
                                    <div className="card-features">
                                        {protocol.features.slice(0, 2).map((f, i) => (
                                            <span key={i} className="feature-tag">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="protocol-test-page">
            {/* Header */}
            <div className="protocol-header">
                <div className="header-title">
                    <h1><HeaderIcon /> Protocol Testing</h1>
                    <p>Test WebSocket, gRPC, SOAP, MQTT, and SSE protocols</p>
                </div>

                <div className="header-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'tester' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tester')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                        Protocol Tester
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'converter' ? 'active' : ''}`}
                        onClick={() => setActiveTab('converter')}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 1 21 5 17 9" />
                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                            <polyline points="7 23 3 19 7 15" />
                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                        Protocol Converter
                    </button>
                </div>
            </div>

            {activeTab === 'tester' ? (
                <>
                    {/* Protocol Selector */}
                    <div className="protocol-selector-bar">
                        <ProtocolSelector
                            selectedProtocol={selectedProtocol}
                            onProtocolChange={setSelectedProtocol}
                            showDescriptions={true}
                        />

                        {selectedProtocol && (
                            <button
                                className="clear-btn"
                                onClick={() => setSelectedProtocol(null)}
                            >
                                ✕ Clear Selection
                            </button>
                        )}
                    </div>

                    {/* Protocol Tester Content */}
                    <div className="protocol-content">
                        {renderProtocolTester()}
                    </div>
                </>
            ) : (
                <div className="protocol-content converter-content">
                    <ProtocolConverterUI />
                </div>
            )}
        </div>
    );
};

export default ProtocolTestPage;
