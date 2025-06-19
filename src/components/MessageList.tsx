import React from 'react';
import { SessionChatMessage } from 'teleparty-websocket-lib';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';

interface MessageListProps {
  nickname: string;
  messages: SessionChatMessage[];
  isMyMessage: (message: SessionChatMessage) => boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<MessageListProps> = ({
  nickname,
  messages,
  isMyMessage,
  messagesEndRef,
}) => {
  const groupedMessages = messages.reduce((groups: SessionChatMessage[][], message) => {
    // Handle system messages separately
    if (message.isSystemMessage) {
      groups.push([message]);
      return groups;
    }

    const isCurrentUser = isMyMessage(message);
    const lastGroup = groups[groups.length - 1];
    
    if (lastGroup && !lastGroup[0].isSystemMessage && isMyMessage(lastGroup[0]) === isCurrentUser) {
      lastGroup.push(message);
    } else {
      groups.push([message]);
    }
    
    return groups;
  }, []);

  const formatSystemMessage = (nickname: string, message: SessionChatMessage) => {
    if (!message.userNickname) return message.body;
    if (nickname === message.userNickname) {
      return `You - ${message.body}`;
    }
    return `${message.userNickname} - ${message.body}`;
  };

  return (
    <div className="messages-container">
      {messages.length === 0 && (
        <div className="empty-chat">
          <p>No messages yet. Start the conversation! 👋</p>
        </div>
      )}
      
      {groupedMessages.map((group, groupIndex) => {
        const isSystemMessage = group[0].isSystemMessage;
        const isCurrentUser = !isSystemMessage && isMyMessage(group[0]);

        if (isSystemMessage) {
          return (
            <div key={groupIndex} className="message-group system-message">
              {group.map((message, messageIndex) => (
                <div key={messageIndex} className="message system-message">
                  <div className="message-body">
                    {formatSystemMessage(nickname, message)}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={groupIndex} className={`message-group ${isCurrentUser ? 'user-message' : 'other-message'}`}>
            {group.map((message, messageIndex) => (
              <div
                key={messageIndex}
                className={`message ${isCurrentUser ? 'user-message' : 'other-message'}`}
              >
                <div className="message-header">
                  <div className="user-avatar">
                    {message.userIcon ? (
                      <img src={message.userIcon} alt={isCurrentUser ? 'You' : message.userNickname} />
                    ) : (
                      <FontAwesomeIcon icon={faUser} />
                    )}
                  </div>
                  <span className="nickname">{isCurrentUser ? 'You' : message.userNickname}</span>
                </div>
                <div className="message-body">
                  {message.body}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}; 