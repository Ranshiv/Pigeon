import React, { useState, useEffect, useRef } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
// import Peer from 'simple-peer'; // Peer dependency would need to be installed

const VideoChatOverlay = () => {
    // Correctly destructure answerCall and leaveCall
    const { socket, outgoingCall, incomingCall, answerCall, leaveCall, callAccepted, userVideo, partnerVideo, stream } = useCollaboration();
    // Getting simple-peer to work requires installing the dependency.
    // For now we will render the UI shell.

    if (incomingCall && !callAccepted) {
        return (
            <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '250px',
                width: '300px',
                backgroundColor: '#1E293B',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                padding: '16px',
                zIndex: 9500,
                textAlign: 'center',
                border: '1px solid #3B82F6',
                animation: 'pulse 2s infinite'
            }}>
                <h3 style={{ color: 'white', marginTop: 0 }}>Incoming Call...</h3>
                <p style={{ color: '#94A3B8' }}>{incomingCall.from.substring(0, 8)}...</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
                    <button
                        onClick={answerCall}
                        style={{ backgroundColor: '#10B981', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Answer
                    </button>
                    <button
                        onClick={leaveCall} // Use clean leaveCall instead of reload
                        style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Decline
                    </button>
                </div>
            </div>
        );
    }

    if (!stream && !callAccepted) return null; // Hide if inactive and no active call

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '250px', // Left of Activity Feed
            width: '300px',
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            zIndex: 9500
        }}>
            <div style={{ padding: '10px', backgroundColor: '#334155', color: 'white', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>Video Chat</span>
                <span style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center' }}>● Live</span>
            </div>

            <div style={{ height: '200px', position: 'relative', backgroundColor: 'black' }}>
                {/* Partner Video */}
                {callAccepted && (
                    <video
                        playsInline
                        ref={partnerVideo}
                        autoPlay
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}

                {/* My Video (PiP) */}
                {stream && (
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '80px', height: '60px', border: '1px solid white', backgroundColor: '#333' }}>
                        <video
                            playsInline
                            muted
                            ref={userVideo}
                            autoPlay
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                        />
                    </div>
                )}
            </div>

            <div style={{ padding: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                    onClick={leaveCall} // Use clean leaveCall instead of reload
                    style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    End Call
                </button>
                <button style={{ backgroundColor: '#64748B', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px' }}>
                    Mute
                </button>
            </div>
        </div>
    );
};

export default VideoChatOverlay;
