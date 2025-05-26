import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

interface ErrorMessageProps {
  error: string;
  showReturnButton?: boolean;
  onReturnToLobby?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  showReturnButton = false,
  onReturnToLobby,
}) => {
  if (!error) return null;

  return (
    <div className="error-message">
      <div>
        <FontAwesomeIcon icon={faExclamationCircle} />
        <span>{error}</span>
      </div>
      {showReturnButton && onReturnToLobby && (
        <button onClick={onReturnToLobby}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Return to Lobby
        </button>
      )}
    </div>
  );
}; 