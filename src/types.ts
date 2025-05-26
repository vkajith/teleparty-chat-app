import { MessageList, SessionChatMessage } from 'teleparty-websocket-lib';

// Define TypingMessageData interface locally since it's not exported from the library
export interface TypingMessageData {
  anyoneTyping: boolean;
  usersTyping: string[];
}

// Event callbacks type
export interface WebSocketCallbacks {
  onMessage: (message: SessionChatMessage) => void;
  onTypingUpdate: (data: TypingMessageData) => void;
  onConnectionChange: (connected: boolean) => void;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (messageList: MessageList) => void;
  onError: (error: string) => void;
  onPreviousMessages?: (messages: SessionChatMessage[]) => void;
}

// App state type
export type AppState = 'initial' | 'creating' | 'joining' | 'in-room';