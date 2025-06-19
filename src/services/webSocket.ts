// websocketService.ts
import { 
  TelepartyClient, 
  SocketEventHandler, 
  SocketMessageTypes,
  SessionChatMessage,
  MessageList
} from 'teleparty-websocket-lib';
import { TypingMessageData, IncomingMessage, AppError, ErrorType } from '../types';

/**
 * Callback interface for WebSocket events
 */
interface WebSocketCallbacks {
  onMessage: (message: SessionChatMessage) => void;
  onTypingUpdate: (data: TypingMessageData) => void;
  onConnectionChange: (connected: boolean) => void;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (messageList: MessageList) => void;
  onError: (error: string | AppError) => void;
}

/**
 * WebSocket service for managing chat room connections and messages
 */
class WebSocketService {
  private client: TelepartyClient | null = null;
  private callbacks: WebSocketCallbacks | null = null;
  private currentNickname: string = '';
  private currentUserId: string = '';
  private currentRoomId: string = '';
  private isConnected: boolean = false;
  private userIcon: string = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly CONNECTION_TIMEOUT_MS = 10000;
  private readonly MAX_NICKNAME_LENGTH = 50;
  private readonly SESSION_STORAGE_KEY = 'teleparty_session';

  constructor() {
    const session = this.loadSession();
    if (session) {
      this.currentRoomId = session.roomId;
      this.currentNickname = session.nickname;
      this.userIcon = session.userIcon;
      this.currentUserId = session.userId;
    }
  }

  /**
   * Initialize WebSocket connection
   */
  private async connect(): Promise<void> {
    // Clear any existing connection
    if (this.client) {
      this.client.teardown();
      this.client = null;
    }

    return new Promise((resolve, reject) => {
      try {
        this.client = new TelepartyClient({
          onConnectionReady: () => {
            this.isConnected = true;
            this.callbacks?.onConnectionChange(true);
            resolve();
          },
          onClose: () => {
            this.isConnected = false;
            this.callbacks?.onConnectionChange(false);
            this.scheduleReconnect();
          },
          onMessage: (message: IncomingMessage) => {
            this.handleIncomingMessage(message);
          }
        });

        // Set connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, this.CONNECTION_TIMEOUT_MS);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      if (!this.isConnected && this.currentRoomId) {
        try {
          await this.connect();
          if (this.currentRoomId && this.currentNickname) {
            await this.joinRoom(this.currentRoomId, this.currentNickname, this.userIcon);
          }
        } catch (error) {
          console.error('Reconnection failed:', error);
        }
      }
    }, 3000);
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId: string, nickname: string, userIcon?: string): Promise<void> {
    if (!roomId?.trim() || !nickname?.trim()) {
      throw new Error('Room ID and nickname are required');
    }

    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.client) {
        throw new Error('Connection failed');
      }

      const messageList = await this.client.joinChatRoom(nickname.trim(), roomId.trim(), userIcon);
      
      // Update state after successful join
      this.currentRoomId = roomId.trim();
      this.currentNickname = nickname.trim();
      this.userIcon = userIcon || '';
      
      // Save session
      this.saveSession();
      
      // Notify success
      this.callbacks?.onRoomJoined(messageList);
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  /**
   * Create a new chat room
   */
  async createRoom(nickname: string, userIcon?: string): Promise<void> {
    if (!nickname?.trim()) {
      throw new Error('Nickname is required');
    }

    try {
      if (!this.isConnected) {
        await this.connect();
      }

      if (!this.client) {
        throw new Error('Connection failed');
      }

      const roomId = await this.client.createChatRoom(nickname.trim(), userIcon);
      
      // Update state after successful creation
      this.currentRoomId = roomId;
      this.currentNickname = nickname.trim();
      this.userIcon = userIcon || '';
      
      // Save session
      this.saveSession();
      
      // Notify success
      this.callbacks?.onRoomCreated(roomId);
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  }

  /**
   * Restore previous session
   */
  async restoreSession(): Promise<{ roomId: string, nickname: string, userIcon: string } | null> {
    const session = this.loadSession();
    if (!session) return null;

    try {
      await this.joinRoom(session.roomId, session.nickname, session.userIcon);
      return session;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): { roomId: string, nickname: string, userIcon: string, userId: string } | null {
    try {
      const data = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (!data) return null;

      const session = JSON.parse(data);
      if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(this.SESSION_STORAGE_KEY);
        return null;
      }

      return {
        roomId: session.roomId,
        nickname: session.nickname,
        userIcon: session.userIcon || '',
        userId: session.userId || '',
      };
    } catch (error) {
      console.warn('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(): void {
    if (this.currentRoomId && this.currentNickname) {
      try {
        localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify({
          roomId: this.currentRoomId,
          nickname: this.currentNickname,
          userId: this.currentUserId,
          userIcon: this.userIcon,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Failed to save session:', error);
      }
    }
  }

  /**
   * Send a chat message
   */
  sendMessage(messageText: string): void {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to chat');
    }

    this.client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
      body: messageText
    });
  }

  /**
   * Update typing status
   */
  setTypingPresence(typing: boolean): void {
    if (this.client && this.isConnected) {
      this.client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, { typing });
    }
  }

  /**
   * Initialize callbacks
   */
  initialize(callbacks: WebSocketCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Disconnect from chat
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.client) {
      this.client.teardown();
      this.client = null;
    }

    this.isConnected = false;
    this.callbacks?.onConnectionChange(false);
  }

  /**
   * Logout and clear all data
   */
  logout(): void {
    // First disconnect from WebSocket
    this.disconnect();
    
    // Clear all session data
    localStorage.removeItem(this.SESSION_STORAGE_KEY);
    
    // Reset all state
    this.currentRoomId = '';
    this.currentNickname = '';
    this.currentUserId = '';
    this.userIcon = '';
    
    // Notify any listeners
    this.callbacks?.onConnectionChange(false);
  }

  // Getters
  getCurrentNickname(): string { return this.currentNickname; }
  getCurrentUserId(): string { return this.currentUserId; }
  getCurrentRoomId(): string { return this.currentRoomId; }
  isClientConnected(): boolean { return this.isConnected; }

  private handleIncomingMessage(message: IncomingMessage): void {
    try {
      if (!message) return;

      if (message.type) {
        switch (message.type) {
          case SocketMessageTypes.SEND_MESSAGE:
            const chatMessage = message.data as SessionChatMessage;
            this.callbacks?.onMessage(chatMessage);
            break;
            
          case SocketMessageTypes.SET_TYPING_PRESENCE:
            this.callbacks?.onTypingUpdate(message.data as TypingMessageData);
            break;
          
          case "userId":
            this.currentUserId = (message.data as { userId: string }).userId;
            break;
            
          default:
            console.warn('Unknown message type:', message);
        }
      } else {
        this.callbacks?.onMessage(message as SessionChatMessage);
      }
    } catch (error) {
      console.error('Failed to process message:', error);
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export type { WebSocketCallbacks, SessionChatMessage };