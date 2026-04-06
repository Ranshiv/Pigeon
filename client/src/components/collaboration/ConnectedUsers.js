import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { FiVideo, FiUser } from 'react-icons/fi';

const ConnectedUsers = ({ isOpen, onToggle }) => {
    const { currentRoom, activeRooms, callUser, socket } = useCollaboration();
    const [users, setUsers] = useState([]);

    // Get current user ID from localStorage or socket
    const currentUserId = localStorage.getItem('userId') || (socket ? socket.id : null);

    useEffect(() => {
        if (currentRoom && activeRooms && activeRooms[currentRoom]) {
            setUsers(activeRooms[currentRoom]);
        } else {
            setUsers([]);
        }
    }, [currentRoom, activeRooms]);

    if (!currentRoom) return null;

    return (
        <>
            {/* Toggle Button for Users List */}
            <button
                onClick={onToggle}
                className={`
                    fixed top-[120px] z-[901] flex items-center gap-2 rounded-l-md border border-r-0 border-[var(--border-color)] bg-[var(--sidebar-bg)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-md transition-all hover:bg-[var(--hover-bg)] hover:text-[var(--text-color)]
                    ${isOpen ? 'right-[250px]' : 'right-0'}
                `}
            >
                <FiUser size={14} />
                {!isOpen && <span className="text-xs font-bold">{users.length}</span>}
                {isOpen && <span>Users</span>}
            </button>

            {/* Users List Panel */}
            <div
                className={`
                    fixed bottom-0 right-0 top-[60px] z-[900] w-[250px] transform overflow-y-auto border-l border-[var(--border-color)] bg-[var(--sidebar-bg)] shadow-2xl transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                <div className="flex items-center justify-between border-b border-[var(--border-color)] p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-color)]">Online Users</h3>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hover-bg)] text-[10px] font-bold text-[var(--text-secondary)]">
                        {users.length}
                    </div>
                </div>

                <div className="flex flex-col gap-2 p-3">
                    {users.length === 0 && (
                        <div className="py-8 text-center text-xs italic text-[var(--text-muted)]">
                            No other users in this room.
                        </div>
                    )}

                    {users.map(user => {
                        // Robustly check if this user is me
                        const storedUserId = localStorage.getItem('userId');
                        const isMe = (user.id === socket?.id) || (user.userId === storedUserId);

                        return (
                            <div
                                key={user.id}
                                className={`
                                    flex items-center justify-between rounded-lg border p-2 transition-all shadow-sm
                                    ${isMe
                                        ? 'border-[var(--primary-color)] bg-[var(--primary-light)]'
                                        : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)]'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-white/10
                                        ${isMe ? 'bg-[var(--primary-color)]' : 'bg-slate-500'}
                                    `}>
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-sm font-medium ${isMe ? 'text-[var(--primary-color)]' : 'text-[var(--text-color)]'}`}>
                                            {user.name || 'Guest'} {isMe && '(You)'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`block h-1.5 w-1.5 rounded-full ${isMe ? 'bg-emerald-500' : 'bg-emerald-400'}`}></span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">
                                                {isMe ? 'Online' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {!isMe && (
                                    <button
                                        onClick={() => callUser(user.socketId || user.id)}
                                        title={`Video Call ${user.name}`}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                                    >
                                        <FiVideo size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 px-4 text-center">
                    <p className="text-[10px] text-[var(--text-muted)] break-all opacity-60">
                        Room: {currentRoom}
                    </p>
                </div>
            </div>
        </>
    );
};

export default ConnectedUsers;
