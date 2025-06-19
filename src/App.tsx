import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { webSocketService } from './services/webSocket';
import { WebSocketCallbacks, TypingUser, AppError, TypingMessageData } from './types';
import { MessageList, SessionChatMessage } from 'teleparty-websocket-lib';
import { ChatRoom } from './components/ChatRoom';
import { AVATAR_ICONS } from './constants';

type AppState = 'initial' | 'creating' | 'joining' | 'in-room';

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
  const [userIcon, setUserIcon] = useState(AVATAR_ICONS[0]);
  const [showJoinForm, setShowJoinForm] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Callback to handle typing updates
  const handleTypingUpdate = useCallback((data: TypingMessageData) => {
    console.log('Typing update received:', data, 'Current nickname:', nickname);
    
    // Filter out current user from typing indicators
    const filteredUsers = (data.usersTyping || []).filter((user: string | TypingUser) => {
      // Handle both string usernames and user objects
      if (typeof user === 'string') {
        const isCurrentUser = user === nickname;
        console.log(`Comparing string "${user}" with "${nickname}": ${isCurrentUser ? 'MATCH (filtering out)' : 'different'}`);
        return !isCurrentUser;
      } else if (user && typeof user === 'object') {
        const isCurrentUser = user.userNickname === nickname || user.nickname === nickname;
        console.log(`Comparing object`, user, `with "${nickname}": ${isCurrentUser ? 'MATCH (filtering out)' : 'different'}`);
        return !isCurrentUser;
      }
      return true;
    }).map((user: string | TypingUser) => {
      // Convert all users to string format for display
      return typeof user === 'string' ? user : (user.userNickname || user.nickname || 'Unknown');
    });
    
    console.log('Filtered users:', filteredUsers);
    setOthersTyping(filteredUsers.length > 0);
    setTypingUsers(filteredUsers);
  }, [nickname]);

  // Initialize WebSocket service once
  useEffect(() => {
    const callbacks: WebSocketCallbacks = {
      onMessage: (message: SessionChatMessage | SessionChatMessage[]) => {
        if (Array.isArray(message)) {
          setMessages(message);
          setAppState('in-room');
          setCurrentRoomId(webSocketService.getCurrentRoomId());
        } else {
          setMessages(prev => [...prev, message]);
        }
      },
      
      onTypingUpdate: handleTypingUpdate,
      
      onConnectionChange: (connected: boolean) => {
        setIsConnected(connected);
        if (!connected) {
          setConnectionError('Connection lost. Attempting to reconnect...');
        } else {
          setConnectionError('');
        }
      },
      
      onRoomCreated: (roomId: string) => {
        setCurrentRoomId(roomId);
        setAppState('in-room');
        setConnectionError('');
      },
      
      onRoomJoined: (messageList: MessageList) => {
        setMessages(messageList.messages);
        setAppState('in-room');
        setCurrentRoomId(webSocketService.getCurrentRoomId());
        setConnectionError('');
      },
      
      onError: (error: string | AppError) => {
        const errorMessage = typeof error === 'string' ? error : error.message;
        setConnectionError(errorMessage);
        setAppState('initial');
      }
    };
    
    webSocketService.initialize(callbacks);
    
    // Try to restore session on initial load
    const tryRestoreSession = async () => {
      if (webSocketService.hasSavedSession()) {
        const savedSession = webSocketService.getSavedSession();
        if (savedSession) {
          setNickname(savedSession.nickname);
          setUserIcon(savedSession.userIcon);
          setCurrentRoomId(savedSession.roomId);
          setAppState('joining');
          try {
            await webSocketService.restoreSession();
          } catch (error) {
            setConnectionError(error instanceof Error ? error.message : 'Failed to restore session');
            setAppState('initial');
          }
        }
      }
    };
    
    tryRestoreSession();
    
    return () => {
      webSocketService.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [handleTypingUpdate]); // Include handleTypingUpdate in dependencies

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        webSocketService.setTypingPresence(false);
      }, 3000);
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = undefined;
      }
    };
  }, [isTyping]);

  useEffect(() => {
    let clearTypingTimeout: NodeJS.Timeout;
    if (othersTyping) {
      clearTypingTimeout = setTimeout(() => {
        setOthersTyping(false);
        setTypingUsers([]);
      }, 5000);
    }
    return () => {
      if (clearTypingTimeout) {
        clearTimeout(clearTypingTimeout);
      }
    };
  }, [othersTyping]);

  const handleCreateRoom = async () => {
    if (!nickname.trim()) return;
    setAppState('creating');
    setConnectionError('');
    try {
      await webSocketService.createRoom(nickname, userIcon);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to create room');
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
      setConnectionError(error instanceof Error ? error.message : 'Failed to join room');
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
      setConnectionError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    const isTypingNow = e.target.value.trim().length > 0;
    if (isTypingNow !== isTyping) {
      setIsTyping(isTypingNow);
      webSocketService.setTypingPresence(isTypingNow);
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

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(currentRoomId);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = currentRoomId;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(textArea);
    }
  };

  const isMyMessage = (message: SessionChatMessage): boolean => {
    return message.userNickname === nickname;
  };

  const getTypingMessage = (): string => {
    if (!othersTyping || typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
  };

  const renderInitialScreen = () => (
    <div className="initial-screen">
      <h1>Welcome to Teleparty Chat</h1>
      
      <div className="form-toggle">
        <button 
          className={!showJoinForm ? 'active' : ''} 
          onClick={() => setShowJoinForm(false)}
        >
          Create Room
        </button>
        <button 
          className={showJoinForm ? 'active' : ''} 
          onClick={() => setShowJoinForm(true)}
        >
          Join Room
        </button>
      </div>
      
      <div className="user-setup">
        <div className="nickname-input">
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
          />
        </div>
        
        <div className="icon-picker">
          <button 
            className="icon-picker-button"
            onClick={() => setUserIcon(AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)])}
          >
            <img src={userIcon} alt="Selected icon" />
          </button>
        </div>
      </div>
      
      <div className="form-container" style={{ display: !showJoinForm ? 'block' : 'none' }}>
        <div className="room-form">
          <button 
            onClick={handleCreateRoom} 
            disabled={!nickname.trim()}
          >
            Create New Room
          </button>
        </div>
      </div>
      
      <div className="form-container" style={{ display: showJoinForm ? 'block' : 'none' }}>
        <div className="room-form">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button 
            onClick={handleJoinRoom}
            disabled={!nickname.trim() || !roomId.trim()}
          >
            Join Room
          </button>
        </div>
      </div>
      
      {connectionError && (
        <div className="error-message">
          <span>⚠️ {connectionError}</span>
        </div>
      )}
    </div>
  );

  const renderLoadingScreen = () => (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>{appState === 'creating' ? 'Creating room...' : 'Joining room...'}</p>
      <button onClick={handleReturnToLobby} className="cancel-btn">Cancel</button>
    </div>
  );

  return (
    <div className="app">
      {appState === 'initial' && renderInitialScreen()}
      {(appState === 'creating' || appState === 'joining') && renderLoadingScreen()}
      {appState === 'in-room' && (
        <ChatRoom
          roomId={currentRoomId}
          nickname={nickname}
          messages={messages}
          messageInput={messageInput}
          isConnected={isConnected}
          othersTyping={othersTyping}
          typingMessage={getTypingMessage()}
          connectionError={connectionError}
          messagesEndRef={messagesEndRef}
          isMyMessage={isMyMessage}
          onCopyRoomId={copyRoomId}
          onLeaveRoom={handleReturnToLobby}
          onMessageInputChange={handleMessageInputChange}
          onSendMessage={handleSendMessage}
        />
      )}
    </div>
  );
};

export default App;