import { MessageList, SessionChatMessage } from 'teleparty-websocket-lib';

// Define TypingMessageData interface locally since it's not exported from the library
export interface TypingMessageData {
  anyoneTyping: boolean;
  usersTyping: string[];
}

// Define types for better type safety
export interface IncomingMessage {
  type?: string;
  data?: any;
  userNickname?: string;
  permId?: string;
  body?: string;
  timestamp?: number;
}

export interface TypingUser {
  userNickname?: string;
  nickname?: string;
}

// Error types for better error handling
export enum ErrorType {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  timestamp: number;
  recoverable: boolean;
}

// Event callbacks type
export interface WebSocketCallbacks {
  onMessage: (message: SessionChatMessage) => void;
  onTypingUpdate: (data: TypingMessageData) => void;
  onConnectionChange: (connected: boolean) => void;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (messageList: MessageList) => void;
  onError: (error: string | AppError) => void;
  onPreviousMessages?: (messages: SessionChatMessage[]) => void;
}

// App state type
export type AppState = 'initial' | 'creating' | 'joining' | 'in-room';