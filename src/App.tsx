import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { webSocketService } from './services/webSocket';
import { WebSocketCallbacks, AppError, TypingMessageData } from './types';
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
  const [isLoading, setIsLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Callback to handle typing updates
  const handleTypingUpdate = useCallback((data: TypingMessageData) => {
    const currentUserId = webSocketService.getCurrentUserId();
    const filteredUsers = (data.usersTyping || []).filter(userId => userId !== currentUserId);
    setOthersTyping(filteredUsers.length > 0);
    setTypingUsers(filteredUsers);
  }, []); // Remove nickname from dependencies as it's not used

  // Initialize WebSocket service once
  useEffect(() => {
    const callbacks: WebSocketCallbacks = {
      onMessage: (message: SessionChatMessage | SessionChatMessage[]) => {
        if (Array.isArray(message)) {
          setMessages(message);
          setCurrentRoomId(webSocketService.getCurrentRoomId());
        } else {
          setMessages(prev => [...prev, message]);
        }
      },
      
      onTypingUpdate: handleTypingUpdate,
      
      onConnectionChange: (connected: boolean) => {
        setIsConnected(connected);
        if (!connected) {
          setOthersTyping(false);
          setTypingUsers([]);
        }
      },
      
      onRoomCreated: (roomId: string) => {
        setCurrentRoomId(roomId);
        setAppState('in-room');
        setConnectionError('');
        setIsLoading(false);
      },
      
      onRoomJoined: (messageList: MessageList) => {
        setMessages(messageList.messages);
        setAppState('in-room');
        setCurrentRoomId(webSocketService.getCurrentRoomId());
        setConnectionError('');
        setIsLoading(false);
      },
      
      onError: (error: string | AppError) => {
        const errorMessage = typeof error === 'string' ? error : error.message;
        setConnectionError(errorMessage);
        setAppState('initial');
        setIsLoading(false);
      }
    };
    
    webSocketService.initialize(callbacks);
    
    // Try to restore session on initial load
    const tryRestoreSession = async () => {
      const session = await webSocketService.restoreSession();
      if(!session){
        setIsLoading(false);
      }
      if (session) {
        setNickname(session.nickname);
        setUserIcon(session.userIcon);
        setCurrentRoomId(session.roomId);
      }
    };
    
    if (appState === 'initial') {
      tryRestoreSession();
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [handleTypingUpdate, appState]); // Add appState to dependencies

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
      }, 1500);
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
      }, 2000);
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
    const newValue = e.target.value;
    setMessageInput(newValue);
    
    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing status based on content
    if (newValue.trim().length > 0) {
      setIsTyping(true);
    }  
  };

  useEffect(() => {
    webSocketService.setTypingPresence(isTyping);
  }, [isTyping]);

  const handleReturnToLobby = () => {
    webSocketService.logout(); // This will clear session and disconnect
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
    setNickname('');
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
    return 'Someone is typing...';
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
      <div className="loading-text">
        {appState === 'creating' ? 'Creating your chat room' : 'Joining the chat room'}<span className="loading-dots"></span>
      </div>
      <button onClick={handleReturnToLobby} className="cancel-btn">
        Cancel
      </button>
    </div>
  );

  if(isLoading){
    return (
      <div className='app loading-screen'>
        <div className="spinner"></div>
        <div className="loading-text">
          Initializing chat<span className="loading-dots"></span>
        </div>
      </div>
    )
  }

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