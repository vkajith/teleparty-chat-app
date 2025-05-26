import React from 'react';

interface ChatHeaderProps {
  roomId: string;
  nickname: string;
  isConnected: boolean;
  onCopyRoomId: () => void;
  onLeaveRoom: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  roomId,
  nickname,
  isConnected,
  onCopyRoomId,
  onLeaveRoom,
}) => {
  return (
    <div className="chat-header">
      <div className="room-info">
        <h2>Room: {roomId}</h2>
        <div className="room-actions-header">
          <button onClick={onCopyRoomId} className="copy-room-btn" title="Copy Room ID">
            📋 Copy ID
          </button>
          <button onClick={onLeaveRoom} className="leave-room-btn">
            Leave Room
          </button>
        </div>
      </div>
      <div className="user-info">
        <span>👤 {nickname}</span>
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
    </div>
  );
}; 