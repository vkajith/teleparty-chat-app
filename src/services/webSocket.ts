// websocketService.ts
import { 
    TelepartyClient, 
    SocketEventHandler, 
    SocketMessageTypes,
    SessionChatMessage
  } from 'teleparty-websocket-lib';
import { TypingMessageData } from '../types';
import { WebSocketCallbacks } from '../types';
  
  
  class WebSocketService {
    private client: TelepartyClient | null = null;
    private callbacks: WebSocketCallbacks | null = null;
    private currentNickname: string = '';
    private currentRoomId: string = '';
    private isConnected: boolean = false;
  
    constructor() {
      // Service initialized
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
      
      const cleanRoomId = roomId.trim();
      
      if (cleanRoomId.length === 0) {
        throw new Error('Room ID cannot be empty');
      }
      
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
      
      return cleanNickname;
    }
  
    // Create a new chat room
    async createRoom(nickname: string, userIcon?: string): Promise<string> {
      const cleanNickname = this.validateNickname(nickname);
      this.currentNickname = cleanNickname;
      
      try {
        const eventHandler: SocketEventHandler = {
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
  
        this.client = new TelepartyClient(eventHandler);
        
        // Wait a bit for the client to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.client) {
          throw new Error('Client failed to initialize');
        }
        
        const roomId = await this.client.createChatRoom(cleanNickname, userIcon || undefined);
        this.currentRoomId = roomId;
        
        this.callbacks?.onRoomCreated(roomId);
        return roomId;
        
      } catch (error) {
        this.cleanup();
        
        let errorMessage = 'Failed to create room';
        if (error instanceof Error && error.message) {
          errorMessage += `: ${error.message}`;
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
      
      try {
        const eventHandler: SocketEventHandler = {
          onConnectionReady: () => {
            this.isConnected = true;
            this.callbacks?.onConnectionChange(true);
            this.callbacks?.onRoomJoined();
          },
          
          onClose: () => {
            this.isConnected = false;
            this.callbacks?.onConnectionChange(false);
          },
          
          onMessage: (message: any) => {
            this.handleIncomingMessage(message);
          }
        };
  
        this.client = new TelepartyClient(eventHandler);
        
        // Wait a bit for the client to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.client) {
          throw new Error('Client failed to initialize');
        }
        
        // Fixed parameter order: nickname first, then roomId
        await this.client.joinChatRoom(cleanNickname, cleanRoomId, userIcon || undefined);
        
      } catch (error) {
        this.cleanup();
        
        if (error instanceof Error) {
          throw new Error(`Failed to join room: ${error.message}`);
        } else {
          throw new Error('Failed to join room');
        }
      }
    }
  
    // Handle incoming messages based on type
    private handleIncomingMessage(message: any): void {
      try {
        if (message && typeof message === 'object' && message.type) {
          switch (message.type) {
            case SocketMessageTypes.SEND_MESSAGE:
              if (message.data) {
                this.callbacks?.onMessage(message.data as SessionChatMessage);
              }
              break;
              
            case SocketMessageTypes.SET_TYPING_PRESENCE:
              if (message.data) {
                this.callbacks?.onTypingUpdate(message.data as TypingMessageData);
              }
              break;
          }
        } 
        else if (message && typeof message === 'object' && message.body !== undefined) {
          this.callbacks?.onMessage(message as SessionChatMessage);
        }
        else if (typeof message === 'string') {
          const chatMessage: SessionChatMessage = {
            isSystemMessage: false,
            body: message,
            permId: 'unknown_' + Date.now(),
            timestamp: Date.now(),
            userNickname: 'Unknown'
          };
          this.callbacks?.onMessage(chatMessage);
        }
      } catch (error) {
        // Silently handle message processing errors
      }
    }
  
    // Send a chat message
    sendMessage(messageText: string): void {
      if (!this.client) {
        throw new Error('WebSocket service not initialized');
      }
      
      try {
        const messageData: any = {
          body: messageText
        };
        
        this.client.sendMessage(SocketMessageTypes.SEND_MESSAGE, messageData);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        throw new Error(errorMessage);
      }
    }
  
    // Update typing presence
    setTypingPresence(typing: boolean): void {
      if (!this.client) {
        return;
      }
      
      try {
        const typingData: any = {
          typing: typing
        };
        
        this.client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, typingData);
      } catch (error) {
        // Silently fail for typing indicators
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
      if (this.client) {
        try {
          if (typeof (this.client as any).disconnect === 'function') {
            (this.client as any).disconnect();
          }
          this.client = null;
        } catch (error) {
          // Silently handle disconnect errors
        }
      }
      
      this.isConnected = false;
      this.currentNickname = '';
      this.currentRoomId = '';
      this.callbacks?.onConnectionChange(false);
    }
  }
  
  // Export singleton instance
  export const webSocketService = new WebSocketService();