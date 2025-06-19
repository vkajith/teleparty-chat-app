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
  private connectionTimeout: NodeJS.Timeout | null = null;
  private userIcon: string = '';
  private isManualDisconnect: boolean = false;
  private lastDisconnectTime: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseReconnectDelay: number = 1000;

  private readonly CONNECTION_TIMEOUT_MS = 10000;
  private readonly MAX_NICKNAME_LENGTH = 50;
  private readonly SESSION_STORAGE_KEY = 'teleparty_session';

  constructor() {
    this.loadSession();
  }

  /**
   * Save current session to localStorage
   */
  private saveSession(): void {
    if (this.currentRoomId && this.currentNickname) {
      const sessionData = {
        roomId: this.currentRoomId,
        nickname: this.currentNickname,
        userIcon: this.userIcon,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      } catch (error) {
        console.warn('Failed to save session:', error);
      }
    }
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    try {
      const sessionData = localStorage.getItem(this.SESSION_STORAGE_KEY);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Check if session is less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          this.currentRoomId = parsed.roomId;
          this.currentNickname = parsed.nickname;
          this.userIcon = parsed.userIcon || '';
        } else {
          // Clear expired session
          this.clearSession();
        }
      }
    } catch (error) {
      console.warn('Failed to load session:', error);
      this.clearSession();
    }
  }

  /**
   * Clear saved session
   */
  private clearSession(): void {
    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  }

  /**
   * Check if there's a saved session
   */
  hasSavedSession(): boolean {
    return !!(this.currentRoomId && this.currentNickname);
  }

  /**
   * Get saved session data
   */
  getSavedSession(): { roomId: string, nickname: string, userIcon: string } | null {
    if (this.hasSavedSession()) {
      return {
        roomId: this.currentRoomId,
        nickname: this.currentNickname,
        userIcon: this.userIcon
      };
    }
    return null;
  }

  /**
   * Restore session by rejoining the room
   */
  async restoreSession(): Promise<void> {
    if (!this.hasSavedSession()) {
      throw new Error('No saved session to restore');
    }
    
    try {
      await this.joinRoom(this.currentRoomId, this.currentNickname, this.userIcon);
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  /**
   * Wait for connection to be ready with timeout
   */
  private async waitForConnection(timeoutMs: number = this.CONNECTION_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.isConnected) {
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Connection timeout - server may be unavailable'));
          return;
        }
        
        setTimeout(checkConnection, 100);
      };
      
      checkConnection();
    });
  }

  /**
   * Initialize the service with callbacks
   */
  initialize(callbacks: WebSocketCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Validate and sanitize room ID
   */
  private validateRoomId(roomId: string): string {
    if (!roomId?.trim()) {
      throw new Error('Room ID is required and cannot be empty');
    }
    return roomId.trim();
  }

  /**
   * Validate and sanitize nickname
   */
  private validateNickname(nickname: string): string {
    if (!nickname?.trim()) {
      throw new Error('Nickname is required and cannot be empty');
    }
    
    const cleanNickname = nickname.trim();
    
    if (cleanNickname.length > this.MAX_NICKNAME_LENGTH) {
      throw new Error(`Nickname is too long (max ${this.MAX_NICKNAME_LENGTH} characters)`);
    }
    
    return cleanNickname;
  }

  /**
   * Create event handler for WebSocket events
   */
  private createEventHandler(): SocketEventHandler {
    return {
      onConnectionReady: () => {
        this.isConnected = true;
        this.callbacks?.onConnectionChange(true);
      },
      
      onClose: () => {
        this.isConnected = false;
        this.lastDisconnectTime = Date.now();
        this.callbacks?.onConnectionChange(false);
        
        // If it wasn't a manual disconnect and we have session data,
        // attempt exponential backoff reconnection
        if (!this.isManualDisconnect && this.currentRoomId && this.currentNickname) {
          this.attemptReconnectWithBackoff();
        }
      },
      
      onMessage: (message: IncomingMessage) => {
        this.handleIncomingMessage(message);
      }
    };
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnectWithBackoff(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.callbacks?.onError('Unable to reconnect after multiple attempts. Please refresh the page.');
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(async () => {
      if (!this.isConnected && !this.isManualDisconnect) {
        try {
          await this.reconnect();
          this.reconnectAttempts = 0; // Reset on successful reconnection
        } catch (error) {
          console.warn(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
          this.attemptReconnectWithBackoff();
        }
      }
    }, delay);
  }

  /**
   * Manually reconnect by creating a new client
   */
  async reconnect(): Promise<void> {
    if (!this.currentRoomId || !this.currentNickname) {
      throw new Error('No session to reconnect to');
    }
    
    // Clean up existing client
    if (this.client) {
      this.client.teardown();
      this.client = null;
    }
    
    this.isManualDisconnect = false;
    await this.joinRoom(this.currentRoomId, this.currentNickname, this.userIcon);
  }

  /**
   * Create a new chat room
   */
  async createRoom(nickname: string, userIcon?: string): Promise<void> {
    const cleanNickname = this.validateNickname(nickname);
    this.currentNickname = cleanNickname;
    this.userIcon = userIcon || '';
    this.isManualDisconnect = false;
    
    try {
      this.client = new TelepartyClient(this.createEventHandler());
      await this.waitForConnection();
      
      const roomId = await this.client.createChatRoom(cleanNickname, userIcon);
      this.currentRoomId = roomId;
      this.saveSession();
      this.callbacks?.onRoomCreated(roomId);
    } catch (error: any) {
      this.handleError('create room', error);
      throw error;
    }
  }

  /**
   * Join an existing chat room
   */
  async joinRoom(roomId: string, nickname: string, userIcon?: string): Promise<void> {
    const cleanRoomId = this.validateRoomId(roomId);
    const cleanNickname = this.validateNickname(nickname);
    
    this.currentNickname = cleanNickname;
    this.currentRoomId = cleanRoomId;
    this.userIcon = userIcon || '';
    this.isManualDisconnect = false;
    
    try {
      this.client = new TelepartyClient(this.createEventHandler());
      await this.waitForConnection();
      
      const messageList = await this.client.joinChatRoom(cleanNickname, cleanRoomId, userIcon);
      this.saveSession();
      this.callbacks?.onRoomJoined(messageList);
    } catch (error: any) {
      this.handleError('join room', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages based on type
   */
  private handleIncomingMessage(message: IncomingMessage): void {
    try {
      if (!message) {
        console.warn('Received null or undefined message');
        return;
      }

      if (message.type) {
        switch (message.type) {
          case SocketMessageTypes.SEND_MESSAGE:
            const chatMessage = message.data as SessionChatMessage;
            
            // If this is our own message, capture our permId for future filtering
            if (chatMessage.userNickname === this.currentNickname && !this.currentUserId) {
              this.currentUserId = chatMessage.permId;
            }
            
            this.callbacks?.onMessage(chatMessage);
            break;
            
          case SocketMessageTypes.SET_TYPING_PRESENCE:
            this.callbacks?.onTypingUpdate(message.data as TypingMessageData);
            break;
            
          default:
            console.warn('Unknown message type:', message.type, message);
        }
      } else {
        // Handle direct message format
        this.callbacks?.onMessage(message as SessionChatMessage);
      }
    } catch (error) {
      console.error('Failed to process incoming message:', error, message);
      this.callbacks?.onError('Failed to process message');
    }
  }

  /**
   * Send a chat message
   */
  sendMessage(messageText: string): void {
    if (!this.validateConnection()) return;

    try {
      this.client?.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
        body: messageText
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      this.callbacks?.onError('Failed to send message');
    }
  }

  /**
   * Update typing presence
   */
  setTypingPresence(typing: boolean): void {
    if (!this.validateConnection(true)) return;

    try {
      this.client?.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing
      });
    } catch (error) {
      console.warn('Failed to send typing presence:', error);
    }
  }

  /**
   * Validate connection state
   */
  private validateConnection(silent: boolean = false): boolean {
    if (!this.client) {
      if (!silent) {
        this.callbacks?.onError('WebSocket service not initialized');
      }
      return false;
    }
    
    if (!this.isConnected) {
      if (!silent) {
        this.callbacks?.onError('Not connected to server');
      }
      return false;
    }
    
    return true;
  }

  /**
   * Create a structured error object
   */
  private createError(type: ErrorType, message: string, recoverable: boolean = true, code?: string): AppError {
    return {
      type,
      message,
      code,
      timestamp: Date.now(),
      recoverable
    };
  }

  /**
   * Handle errors with appropriate messages
   */
  private handleError(operation: string, error: any): void {
    this.cleanup();
    
    let appError: AppError;
    
    if (error?.message) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes('not found') || msg.includes('invalid')) {
        appError = this.createError(
          ErrorType.VALIDATION,
          'Room not found. Please check the room ID and try again.',
          true
        );
      } else if (msg.includes('timeout')) {
        appError = this.createError(
          ErrorType.NETWORK,
          'Connection timeout. Please check your internet connection and try again.',
          true
        );
      } else if (msg.includes('network')) {
        appError = this.createError(
          ErrorType.NETWORK,
          'Network error. Please check your connection and try again.',
          true
        );
      } else if (msg.includes('full')) {
        appError = this.createError(
          ErrorType.CONNECTION,
          'Room is full. Please try again later.',
          false
        );
      } else if (msg.includes('nickname')) {
        appError = this.createError(
          ErrorType.VALIDATION,
          'Invalid nickname. Please try a different name.',
          true
        );
      } else {
        appError = this.createError(
          ErrorType.UNKNOWN,
          `Failed to ${operation}: ${error.message}`,
          true
        );
      }
    } else {
      appError = this.createError(
        ErrorType.UNKNOWN,
        `Failed to ${operation}`,
        true
      );
    }
    
    this.callbacks?.onError(appError);
  }

  /**
   * Get current connection state
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current nickname
   */
  getCurrentNickname(): string {
    return this.currentNickname;
  }

  /**
   * Get current userId
   */
  getCurrentUserId(): string {
    return this.currentUserId;
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.isManualDisconnect = true; // Prevent reconnection attempts
    this.clearSession();
    this.client?.teardown();
    this.cleanup();
  }

  /**
   * Internal cleanup method
   */
  private cleanup(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.client) {
      try {
        if (typeof (this.client as any).disconnect === 'function') {
          (this.client as any).disconnect();
        }
        this.client = null;
      } catch (error) {
        console.warn('Failed to cleanup client during teardown:', error);
      }
    }
    
    this.isConnected = false;
    this.isManualDisconnect = true;
    this.currentNickname = '';
    this.currentUserId = '';
    this.currentRoomId = '';
    this.userIcon = '';
    this.callbacks?.onConnectionChange(false);
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export type { WebSocketCallbacks, SessionChatMessage };