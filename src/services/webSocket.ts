// websocketService.ts
import { 
  TelepartyClient, 
  SocketEventHandler, 
  SocketMessageTypes,
  SessionChatMessage,
  MessageList
} from 'teleparty-websocket-lib';
import { TypingMessageData } from '../types';

/**
 * Callback interface for WebSocket events
 */
interface WebSocketCallbacks {
  onMessage: (message: SessionChatMessage) => void;
  onTypingUpdate: (data: TypingMessageData) => void;
  onConnectionChange: (connected: boolean) => void;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (messageList: MessageList) => void;
  onError: (error: string) => void;
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

  private readonly CONNECTION_TIMEOUT_MS = 10000;
  private readonly MAX_NICKNAME_LENGTH = 50;

  constructor() {}

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
        this.callbacks?.onConnectionChange(false);
      },
      
      onMessage: (message: any) => {
        this.handleIncomingMessage(message);
      }
    };
  }

  /**
   * Create a new chat room
   */
  async createRoom(nickname: string, userIcon?: string): Promise<void> {
    const cleanNickname = this.validateNickname(nickname);
    this.currentNickname = cleanNickname;
    
    try {
      this.client = new TelepartyClient(this.createEventHandler());
      await this.waitForConnection();
      
      const roomId = await this.client.createChatRoom(cleanNickname, userIcon);
      this.currentRoomId = roomId;
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
    
    try {
      this.client = new TelepartyClient(this.createEventHandler());
      await this.waitForConnection();
      
      const messageList = await this.client.joinChatRoom(cleanNickname, cleanRoomId, userIcon);
      this.callbacks?.onRoomJoined(messageList);
    } catch (error: any) {
      this.handleError('join room', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages based on type
   */
  private handleIncomingMessage(message: any): void {
    try {
      if (!message) return;

      if (message.type) {
        switch (message.type) {
          case SocketMessageTypes.SEND_MESSAGE:
            this.callbacks?.onMessage(message.data as SessionChatMessage);
            break;
            
          case SocketMessageTypes.SET_TYPING_PRESENCE:
            this.callbacks?.onTypingUpdate(message.data);
            break;
            
          default:
            console.warn('Unknown message type:', message.type);
        }
      } else {
        this.callbacks?.onMessage(message as SessionChatMessage);
      }
    } catch (error) {
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
    } catch (error) {}
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
   * Handle errors with appropriate messages
   */
  private handleError(operation: string, error: any): void {
    this.cleanup();
    
    let errorMessage = `Failed to ${operation}`;
    if (error?.message) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes('not found') || msg.includes('invalid')) {
        errorMessage = `Room not found. Please check the room ID and try again.`;
      } else if (msg.includes('timeout')) {
        errorMessage = 'Connection timeout. Please check your internet connection and try again.';
      } else if (msg.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (msg.includes('full')) {
        errorMessage = 'Room is full. Please try again later.';
      } else if (msg.includes('nickname')) {
        errorMessage = 'Invalid nickname. Please try a different name.';
      } else {
        errorMessage += `: ${error.message}`;
      }
    }
    
    this.callbacks?.onError(errorMessage);
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
    this.client?.teardown()
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
      } catch (error) {}
    }
    
    this.isConnected = false;
    this.currentNickname = '';
    this.currentUserId = '';
    this.currentRoomId = '';
    this.callbacks?.onConnectionChange(false);
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export type { WebSocketCallbacks, SessionChatMessage };