import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faComments, 
  faPaperPlane, 
  faCopy, 
  faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';
import { SessionChatMessage } from 'teleparty-websocket-lib';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { ErrorMessage } from './ErrorMessage';

interface ChatRoomProps {
  roomId: string;
  nickname: string;
  messages: SessionChatMessage[];
  messageInput: string;
  isConnected: boolean;
  othersTyping: boolean;
  typingMessage: string;
  connectionError: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isMyMessage: (message: SessionChatMessage) => boolean;
  onCopyRoomId: () => void;
  onLeaveRoom: () => void;
  onMessageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: (e: React.FormEvent) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  roomId,
  nickname,
  messages,
  messageInput,
  isConnected,
  othersTyping,
  typingMessage,
  connectionError,
  messagesEndRef,
  isMyMessage,
  onCopyRoomId,
  onLeaveRoom,
  onMessageInputChange,
  onSendMessage,
}) => {
  return (
    <div className="chat-room">
      <div className="chat-header">
        <h2>
          <FontAwesomeIcon icon={faComments} />
          Chat Room
        </h2>
        <div className="header-actions">
          <button onClick={onCopyRoomId}>
            <FontAwesomeIcon icon={faCopy} />
          </button>
          <button onClick={onLeaveRoom}>
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      </div>

      <div className="messages-container">
        <MessageList
          nickname={nickname}
          messages={messages}
          isMyMessage={isMyMessage}
          messagesEndRef={messagesEndRef}
        />
        {othersTyping && <TypingIndicator typingMessage={typingMessage} />}
      </div>

      <div className="message-form">
        <form onSubmit={onSendMessage}>
          <input
            type="text"
            value={messageInput}
            onChange={onMessageInputChange}
            placeholder="Type a message..."
            disabled={!isConnected}
          />
          <button type="submit" disabled={!isConnected || !messageInput.trim()}>
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </form>
      </div>

      {connectionError && (
        <ErrorMessage
          error={connectionError}
          showReturnButton={true}
          onReturnToLobby={onLeaveRoom}
        />
      )}
    </div>
  );
}; 