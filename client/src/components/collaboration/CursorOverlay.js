import React, { useMemo } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';

const CursorOverlay = () => {
    const { cursors, socket } = useCollaboration();
    const currentUserId = socket?.id; // Or user ID from auth

    // Filter cursors for current route/page if needed
    // For now we show all in room, assuming room = page context approximately

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999,
            overflow: 'hidden'
        }}>
            {Object.entries(cursors).map(([userId, cursor]) => {
                if (userId === currentUserId) return null; // Don't show own cursor

                // Don't show if inactive for > 5 seconds
                if (Date.now() - cursor.lastActive > 5000) return null;

                return (
                    <div
                        key={userId}
                        style={{
                            position: 'absolute',
                            left: `${cursor.position.x * 100}%`,
                            top: `${cursor.position.y * 100}%`,
                            transition: 'all 0.1s linear',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                        }}
                    >
                        {/* Cursor Icon */}
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }}
                        >
                            <path
                                d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19138L15.6841 12.3673H5.65376Z"
                                fill="#2563EB"
                                stroke="white"
                            />
                        </svg>

                        {/* User Label (optional) */}
                        <div style={{
                            backgroundColor: '#2563EB',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            whiteSpace: 'nowrap',
                            marginLeft: '10px',
                            marginTop: '-15px'
                        }}>
                            User {userId.substr(0, 4)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CursorOverlay;
