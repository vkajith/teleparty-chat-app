// websocketService.ts
import { 
  TelepartyClient, 
  SocketEventHandler, 
  SocketMessageTypes,
  SessionChatMessage
} from 'teleparty-websocket-lib';
import { TypingMessageData } from '../types';

// Event callbacks type
interface WebSocketCallbacks {
  onMessage: (message: SessionChatMessage) => void;
  onTypingUpdate: (data: TypingMessageData) => void;
  onConnectionChange: (connected: boolean) => void;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: () => void;
  onError: (error: string) => void;
  onPreviousMessages?: (messages: SessionChatMessage[]) => void;
}

class WebSocketService {
  private client: TelepartyClient | null = null;
  private callbacks: WebSocketCallbacks | null = null;
  private currentNickname: string = '';
  private currentRoomId: string = '';
  private isConnected: boolean = false;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor() {
    console.log('WebSocketService initialized');
  }

  // Wait for connection to be ready with timeout
  private waitForConnection(timeoutMs: number = 10000): Promise<void> {
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

  // Initialize the service with callbacks
  initialize(callbacks: WebSocketCallbacks): void {
    this.callbacks = callbacks;
  }

  // Validate and sanitize room ID
  private validateRoomId(roomId: string): string {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('Room ID is required');
    }
    
    // Trim whitespace
    const cleanRoomId = roomId.trim();
    
    if (cleanRoomId.length === 0) {
      throw new Error('Room ID cannot be empty');
    }
    
    // Log the cleaned room ID
    console.log('🔍 Original room ID:', `"${roomId}"`);
    console.log('🧹 Cleaned room ID:', `"${cleanRoomId}"`);
    
    return cleanRoomId;
  }

  // Validate nickname
  private validateNickname(nickname: string): string {
    if (!nickname || typeof nickname !== 'string') {
      throw new Error('Nickname is required');
    }
    
    const cleanNickname = nickname.trim();
    
    if (cleanNickname.length === 0) {
      throw new Error('Nickname cannot be empty');
    }
    
    if (cleanNickname.length > 50) {
      throw new Error('Nickname is too long (max 50 characters)');
    }
    
    console.log('👤 Cleaned nickname:', `"${cleanNickname}"`);
    
    return cleanNickname;
  }

  // Create a new chat room
  async createRoom(nickname: string, userIcon?: string): Promise<string> {
    const cleanNickname = this.validateNickname(nickname);
    this.currentNickname = cleanNickname;
    
    console.log('Creating room with nickname:', nickname, 'userIcon:', userIcon);
    
    try {
      // Create event handler
      const eventHandler: SocketEventHandler = {
        onConnectionReady: () => {
          console.log('✅ Connection established successfully');
          this.isConnected = true;
          this.callbacks?.onConnectionChange(true);
        },
        
        onClose: () => {
          console.log('❌ Socket closed');
          this.isConnected = false;
          this.callbacks?.onConnectionChange(false);
        },
        
        onMessage: (message: any) => {
          console.log('📨 Received message:', message);
          this.handleIncomingMessage(message);
        }
      };

      console.log('🔌 Initializing TelepartyClient...');
      // Initialize client with event handler
      this.client = new TelepartyClient(eventHandler);
      
      console.log('⏳ Waiting for connection...');
      // Wait for connection to be established
      await this.waitForConnection();
      
      console.log('🏠 Creating chat room...');
      // Create chat room - wait for this to complete
      // Fixed: createChatRoom(nickname, userIcon) vs joinChatRoom(nickname, roomId, userIcon)
      const roomId = await this.client.createChatRoom(cleanNickname, userIcon || undefined);
      
      console.log('✅ Room created successfully with ID:', roomId);
      this.currentRoomId = roomId;
      
      this.callbacks?.onRoomCreated(roomId);
      return roomId;
      
    } catch (error: any) {
      console.error('❌ Detailed error creating room:', error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      
      // Cleanup on error
      this.cleanup();
      
      // Provide more specific error messages
      let errorMessage = 'Failed to create room';
      if (error?.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check your internet connection and try again.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  // Join an existing chat room
  async joinRoom(roomId: string, nickname: string, userIcon?: string): Promise<void> {
    const cleanRoomId = this.validateRoomId(roomId);
    const cleanNickname = this.validateNickname(nickname);
    
    this.currentNickname = cleanNickname;
    this.currentRoomId = cleanRoomId;
    
    console.log('🚪 Attempting to join room:', cleanRoomId, 'with nickname:', cleanNickname, 'userIcon:', userIcon);
    
    try {
      // Create event handler
      const eventHandler: SocketEventHandler = {
        onConnectionReady: () => {
          console.log('✅ Connection established for room join');
          this.isConnected = true;
          this.callbacks?.onConnectionChange(true);
        },
        
        onClose: () => {
          console.log('❌ Socket closed during room join');
          this.isConnected = false;
          this.callbacks?.onConnectionChange(false);
        },
        
        onMessage: (message: any) => {
          console.log('📨 Received message in room:', message);
          this.handleIncomingMessage(message);
        }
      };

      console.log('🔌 Initializing TelepartyClient for join...');
      // Initialize client with event handler
      this.client = new TelepartyClient(eventHandler);
      
      console.log('⏳ Waiting for connection before joining...');
      // Wait for connection to be established
      await this.waitForConnection();
      
      console.log('🚪 Attempting to join chat room with ID:', cleanRoomId);
      // Join chat room
      await this.client.joinChatRoom(cleanNickname,cleanRoomId, userIcon || undefined);
      
      console.log('✅ Successfully joined room:', cleanRoomId);
      this.callbacks?.onRoomJoined();
      
    } catch (error: any) {
      console.error('❌ Detailed error joining room:', error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Room ID attempted:', cleanRoomId);
      console.error('Nickname used:', cleanNickname);
      
      // Cleanup on error
      this.cleanup();
      
      // Provide more specific error messages
      let errorMessage = 'Failed to join room';
      if (error?.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('invalid') || msg.includes('does not exist')) {
          errorMessage = `Room "${cleanRoomId}" not found. Please check the room ID and try again.`;
        } else if (msg.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check your internet connection and try again.';
        } else if (msg.includes('network') || msg.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (msg.includes('full') || msg.includes('capacity')) {
          errorMessage = 'Room is full. Please try again later.';
        } else if (msg.includes('nickname') || msg.includes('name')) {
          errorMessage = 'Invalid nickname. Please try a different name.';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  // Handle incoming messages based on type
  private handleIncomingMessage(message: any): void {
    try {
      // Check if it's a typed message with message type
      if (message.type) {
        switch (message.type) {
          case SocketMessageTypes.SEND_MESSAGE:
            const chatMessage = message.data as SessionChatMessage;
            this.callbacks?.onMessage(chatMessage);
            break;
            
          case SocketMessageTypes.SET_TYPING_PRESENCE:
            this.callbacks?.onTypingUpdate(message.data);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } else {
        // Direct SessionChatMessage
        const chatMessage = message as SessionChatMessage;
        this.callbacks?.onMessage(chatMessage);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  // Send a chat message
  sendMessage(messageText: string): void {
    if (!this.client) {
      throw new Error('WebSocket service not initialized');
    }
    
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }
    
    try {
      this.client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
        body: messageText
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Update typing presence
  setTypingPresence(typing: boolean): void {
    if (!this.client) {
      console.warn('WebSocket service not initialized');
      return;
    }
    
    if (!this.isConnected) {
      return; // Silently fail for typing indicators
    }
    
    try {
      this.client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: typing
      });
    } catch (error) {
      console.error('Failed to send typing presence:', error);
      // Don't throw error for typing indicators
    }
  }

  // Check if connected
  isClientConnected(): boolean {
    return this.isConnected;
  }

  // Get current nickname
  getCurrentNickname(): string {
    return this.currentNickname;
  }

  // Get current room ID
  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  // Disconnect and cleanup
  disconnect(): void {
    this.cleanup();
  }

  // Internal cleanup method
  private cleanup(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.client) {
      try {
        // The library may have a disconnect method
        if (typeof (this.client as any).disconnect === 'function') {
          (this.client as any).disconnect();
        }
        this.client = null;
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
    
    this.isConnected = false;
    this.currentNickname = '';
    this.currentRoomId = '';
    this.callbacks?.onConnectionChange(false);
  }

  // Test method to check if a room exists (if supported by the library)
  async testRoomExists(roomId: string): Promise<boolean> {
    try {
      const cleanRoomId = this.validateRoomId(roomId);
      console.log('🔍 Testing if room exists:', cleanRoomId);
      
      // This is a conceptual method - the actual library may not have this
      // But we can try to join and see what happens
      if (this.client && typeof (this.client as any).checkRoom === 'function') {
        return await (this.client as any).checkRoom(cleanRoomId);
      }
      
      return true; // Assume it exists if we can't check
    } catch (error) {
      console.log('❌ Room existence check failed:', error);
      return false;
    }
  }

  // Get debug info
  getDebugInfo(): object {
    return {
      isConnected: this.isConnected,
      currentNickname: this.currentNickname,
      currentRoomId: this.currentRoomId,
      hasClient: !!this.client,
      clientType: this.client ? this.client.constructor.name : 'none'
    };
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export type { WebSocketCallbacks, SessionChatMessage };