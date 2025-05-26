# Teleparty WebSocket Library Usage

This document shows how the app correctly integrates with `teleparty-websocket-lib` based on the provided API examples.

## 🔌 Library Integration

### Import Statement
```typescript
import { 
  TelepartyClient, 
  SocketEventHandler, 
  SocketMessageTypes,
  SessionChatMessage
} from 'teleparty-websocket-lib';
```

### Client Initialization
```typescript
const eventHandler: SocketEventHandler = {
    onConnectionReady: () => {
        console.log("Connection has been established");
        // Handle connection ready state
    },
    onClose: () => {
        console.log("Socket has been closed");
        // Handle connection close
    },
    onMessage: (message) => {
        console.log("Received message:", message);
        // Process incoming messages
    }
};

const client = new TelepartyClient(eventHandler);
```

### Creating a Chat Room
```typescript
// Create room with nickname and optional user icon
let roomId = await client.createChatRoom(nickname, userIcon);
console.log('Room created with ID:', roomId);
```

### Joining a Chat Room
```typescript
// Join existing room
await client.joinChatRoom(roomId, nickname, userIcon);
console.log('Joined room:', roomId);
```

## 📨 Message Handling

### Sending Chat Messages
```typescript
client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
    body: 'Hello world'
});
```

### Updating Typing Presence
```typescript
// Start typing
client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
    typing: true
});

// Stop typing
client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
    typing: false
});
```

### Receiving Messages
```typescript
const eventHandler: SocketEventHandler = {
    onConnectionReady: () => {
        // Connection established
    },
    onClose: () => {
        // Connection closed
    },
    onMessage: (message) => {
        // Check message type and process accordingly
        if (message.type === SocketMessageTypes.SEND_MESSAGE) {
            const chatMessage = message.data as SessionChatMessage;
            displayChatMessage(chatMessage);
        } else if (message.type === SocketMessageTypes.SET_TYPING_PRESENCE) {
            const typingData = message.data;
            updateTypingIndicator(typingData);
        }
    }
};
```

## 🏗 App Implementation

### WebSocket Service Layer
The app implements a service layer (`websocketService.ts`) that:

1. **Wraps the TelepartyClient** with a clean interface
2. **Handles connection lifecycle** (ready, close, error)
3. **Processes different message types** automatically
4. **Provides error handling** and recovery
5. **Manages state synchronization** with React components

### Key Differences from Mock Implementation

| Feature | Mock Version | Real Library |
|---------|-------------|--------------|
| **Initialization** | `new TelepartyClient()` then `connect()` | `new TelepartyClient(eventHandler)` |
| **Room Creation** | `createRoom(nickname)` | `createChatRoom(nickname, userIcon)` |
| **Room Joining** | `joinRoom(roomId, nickname)` | `joinChatRoom(roomId, nickname, userIcon)` |
| **Connection Events** | `onOpen()` | `onConnectionReady()` |
| **Message Structure** | Direct SessionChatMessage | Wrapped with `type` and `data` |

### React Integration
```typescript
// Component state updates based on WebSocket events
const callbacks: WebSocketCallbacks = {
  onMessage: (message: SessionChatMessage) => {
    setMessages(prev => [...prev, message]);
  },
  onConnectionChange: (connected: boolean) => {
    setIsConnected(connected);
  },
  onRoomCreated: (roomId: string) => {
    setCurrentRoomId(roomId);
    setAppState('in-room');
  }
  // ... other callbacks
};

webSocketService.initialize(callbacks);
```

## 🔧 Error Handling

### Connection Errors
```typescript
try {
  const roomId = await client.createChatRoom(nickname, userIcon);
  // Success handling
} catch (error) {
  console.error('Failed to create room:', error);
  // Show user-friendly error message
}
```

### Message Sending Errors
```typescript
try {
  client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
    body: messageText
  });
} catch (error) {
  console.error('Failed to send message:', error);
  // Retry or show error to user
}
```

## 📋 Complete Flow Example

```typescript
// 1. Initialize client with event handler
const eventHandler: SocketEventHandler = {
  onConnectionReady: () => setConnected(true),
  onClose: () => setConnected(false),
  onMessage: (message) => handleMessage(message)
};

const client = new TelepartyClient(eventHandler);

// 2. Create or join room
const roomId = await client.createChatRoom("John", "👤");

// 3. Send messages
client.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
  body: "Hello everyone!"
});

// 4. Handle typing
client.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
  typing: true
});
```

This implementation correctly follows the teleparty-websocket-lib API patterns and provides a robust, production-ready chat application.