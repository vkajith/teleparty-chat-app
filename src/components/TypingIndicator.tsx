import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisH } from '@fortawesome/free-solid-svg-icons';

interface TypingIndicatorProps {
  typingMessage: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingMessage }) => {
  if (!typingMessage) return null;

  return (
    <div className="typing-indicator">
      <FontAwesomeIcon icon={faEllipsisH} />
      {typingMessage}
    </div>
  );
}; 