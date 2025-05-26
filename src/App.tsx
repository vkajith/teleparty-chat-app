import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { webSocketService } from './services/webSocket';
import { WebSocketCallbacks } from './types';
import { SessionChatMessage } from 'teleparty-websocket-lib';

// Predefined avatar icons
const AVATAR_ICONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Tom',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Anna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Peter',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria'
];

type AppState = 'initial' | 'creating' | 'joining' | 'in-room';

const DEFAULT_USER_ICON = '👤';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('initial');
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [messages, setMessages] = useState<SessionChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [othersTyping, setOthersTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userIcon, setUserIcon] = useState(AVATAR_ICONS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const iconPickerRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket service
  useEffect(() => {
    const callbacks: WebSocketCallbacks = {
      onMessage: (message: SessionChatMessage) => {
        // If it's an array, it's the initial messages
        if (Array.isArray(message)) {
          setMessages(message);
        } else {
          // Otherwise it's a new message
          setMessages(prev => [...prev, message]);
        }
      },
      
      onTypingUpdate: (data: any) => {
        // Handle typing data properly with the correct interface
        setOthersTyping(data.anyoneTyping);
        setTypingUsers(data.usersTyping || []);
      },
      
      onConnectionChange: (connected: boolean) => {
        setIsConnected(connected);
        if (!connected && appState === 'in-room') {
          setConnectionError('Connection lost. Please refresh the page to reconnect.');
        } else if (connected) {
          setConnectionError('');
        }
      },
      
      onRoomCreated: (roomId: string) => {
        setCurrentRoomId(roomId);
        setAppState('in-room');
        setConnectionError('');
      },
      
      onRoomJoined: () => {
        setAppState('in-room');
        setCurrentRoomId(webSocketService.getCurrentRoomId());
        setConnectionError('');
      },
      
      onError: (error: string) => {
        setConnectionError(error);
        setAppState('initial');
      }
    };
    
    webSocketService.initialize(callbacks);
    
    return () => {
      webSocketService.disconnect();
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing timeout
  useEffect(() => {
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        try {
          webSocketService.setTypingPresence(false);
        } catch (error) {
          // Silently handle typing presence errors
        }
      }, 3000); // Increased timeout to 3 seconds
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping]);

  // Clear typing indicator after 5 seconds of no updates
  useEffect(() => {
    if (othersTyping) {
      const clearTypingTimeout = setTimeout(() => {
        setOthersTyping(false);
        setTypingUsers([]);
      }, 5000);
      
      return () => clearTimeout(clearTypingTimeout);
    }
  }, [othersTyping, typingUsers]);

  const handleCreateRoom = async () => {
    if (!nickname.trim()) return;
    setAppState('creating');
    setConnectionError('');
    
    try {
      const roomId = await webSocketService.createRoom(nickname, userIcon);
      setCurrentRoomId(roomId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create room. Please try again.';
      setConnectionError(errorMessage);
      setAppState('initial');
    }
  };

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !roomId.trim()) return;
    
    setAppState('joining');
    setConnectionError('');
    
    try {
      await webSocketService.joinRoom(roomId, nickname, userIcon);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join room. Please try again.';
      setConnectionError(errorMessage);
      setAppState('initial');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    try {
      webSocketService.sendMessage(messageInput);
      setMessageInput('');
      setIsTyping(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please check your connection.';
      setConnectionError(errorMessage);
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    // Handle typing indicator
    if (e.target.value.trim()) {
      if (!isTyping) {
        setIsTyping(true);
        try {
          webSocketService.setTypingPresence(true);
        } catch (error) {
          // Silently handle typing presence errors
        }
      }
    } else {
      if (isTyping) {
        setIsTyping(false);
        try {
          webSocketService.setTypingPresence(false);
        } catch (error) {
          // Silently handle typing presence errors
        }
      }
    }
  };

  const handleReturnToLobby = () => {
    webSocketService.disconnect();
    setAppState('initial');
    setMessages([]);
    setCurrentRoomId('');
    setRoomId('');
    setConnectionError('');
    setIsConnected(false);
    setOthersTyping(false);
    setTypingUsers([]);
    setIsTyping(false);
    setMessageInput('');
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(currentRoomId);
      // Could add a toast notification here
    } catch (error) {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = currentRoomId;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (execError) {
        // Silently fail if copy doesn't work
      }
      document.body.removeChild(textArea);
    }
  };

  const isMyMessage = (message: SessionChatMessage): boolean => {
    return message.userNickname === nickname;
  };

  const getTypingMessage = (): string => {
    if (!othersTyping) {
      return 'User typing...';
    }
    
    // Filter out current user from typing users using nickname
    const otherTypingUsers = typingUsers.filter(nickname => 
      nickname !== webSocketService.getCurrentNickname()
    );
    
    if (otherTypingUsers.length === 0) {
      return '';
    } else if (otherTypingUsers.length === 1) {
      return `${otherTypingUsers[0]} is typing...`;
    } else if (otherTypingUsers.length === 2) {
      return `${otherTypingUsers[0]} and ${otherTypingUsers[1]} are typing...`;
    } else {
      return `${otherTypingUsers[0]} and ${otherTypingUsers.length - 1} others are typing...`;
    }
  };

  const renderErrorMessage = () => {
    if (!connectionError) return null;
    
    return (
      <div className="error-message">
        <span>⚠️ {connectionError}</span>
        {appState === 'in-room' && (
          <button onClick={handleReturnToLobby} className="return-btn">
            Return to Lobby
          </button>
        )}
      </div>
    );
  };

  const handleIconClick = (iconUrl: string) => {
    setUserIcon(iconUrl);
    setShowIconPicker(false);
  };

  // Close icon picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const renderInitialScreen = () => (
    <div className="initial-screen">
      <div className="logo">
        <h1>Teleparty Chat</h1>
        <p>Connect and chat with friends in real-time</p>
      </div>
      
      <div className="user-setup">
        <div className="user-profile">
          <div className="icon-selector">
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              title="Choose your icon"
            >
              <img src={userIcon} alt="User icon" className="user-icon" />
            </button>
            {showIconPicker && (
              <div className="icon-picker-container" ref={iconPickerRef}>
                <div className="icon-grid">
                  {AVATAR_ICONS.map((icon, index) => (
                    <button
                      key={index}
                      className={`icon-option ${icon === userIcon ? 'selected' : ''}`}
                      onClick={() => handleIconClick(icon)}
                    >
                      <img src={icon} alt={`Avatar ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="user-info">
            <div className="nickname-input">
              <input
                type="text"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
            </div>
            <div className="user-status">
              <span className="status-dot"></span>
              <span className="status-text">Ready to chat</span>
            </div>
          </div>
        </div>
      </div>

      <div className="room-actions">
        <button 
          onClick={handleCreateRoom}
          disabled={!nickname.trim()}
          className="create-room-btn"
        >
          Create New Room
        </button>
        
        <div className="join-room">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <button 
            onClick={handleJoinRoom}
            disabled={!nickname.trim() || !roomId.trim()}
            className="join-room-btn"
          >
            Join Room
          </button>
        </div>
        
        {roomId.trim() && (
          <div className="room-id-info">
            <small>Room ID: "{roomId.trim()}"</small>
          </div>
        )}
        
        <div className="help-text">
          <small>
            💡 <strong>Tip:</strong> If you can't join a room, create a new one instead. 
            Room joining may have compatibility issues.
          </small>
        </div>
      </div>
    </div>
  );

  const renderLoadingScreen = () => (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>
        {appState === 'creating' ? 'Creating room...' : 'Joining room...'}
      </p>
      <button onClick={handleReturnToLobby} className="cancel-btn">
        Cancel
      </button>
    </div>
  );

  const renderChatRoom = () => (
    <div className="chat-room">
      <div className="chat-header">
        <div className="room-info">
          <h2>Room: {currentRoomId}</h2>
          <div className="room-actions-header">
            <button onClick={copyRoomId} className="copy-room-btn" title="Copy Room ID">
              📋 Copy ID
            </button>
            <button onClick={handleReturnToLobby} className="leave-room-btn">
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

      {renderErrorMessage()}

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>No messages yet. Start the conversation! 👋</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div 
            key={`${message.permId}-${message.timestamp}-${index}`}
            className={`message ${
              message.isSystemMessage 
                ? 'system-message' 
                : isMyMessage(message) 
                  ? 'my-message' 
                  : 'user-message'
            }`}
          >
            {!message.isSystemMessage && (
              <div className="message-header">
                <div className="message-user">
                  <img 
                    src={message.userIcon || AVATAR_ICONS[0]} 
                    alt="User icon" 
                    className="message-user-icon"
                  />
                  <span className="nickname">
                    {isMyMessage(message) ? 'You' : (message.userNickname || 'Anonymous')}
                  </span>
                </div>
                <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
              </div>
            )}
            <div className="message-body">
              {message.isSystemMessage && <span>{message.userNickname} - </span>}
              {message.body}
            </div>
          </div>
        ))}
        
        {othersTyping && getTypingMessage() && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>{getTypingMessage()}</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-form">
        <div className="message-input-container">
          <input
            type="text"
            placeholder="Type your message..."
            value={messageInput}
            onChange={handleMessageInputChange}
            maxLength={500}
            disabled={!webSocketService.isClientConnected()}
            autoFocus
          />
        </div>
        <button type="submit" disabled={!messageInput.trim() || !webSocketService.isClientConnected()}>
          Send
        </button>
      </form>
    </div>
  );

  return (
    <div className="app">
      {appState === 'initial' && renderInitialScreen()}
      {(appState === 'creating' || appState === 'joining') && renderLoadingScreen()}
      {appState === 'in-room' && renderChatRoom()}
    </div>
  );
};

export default App;