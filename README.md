# sox

A client-side declarative WebSocket abstraction.

- **Automatic reconnection** - Configurable retry attempts with exponential backoff
- **Message queuing** - Messages sent during 'reconnection' / 'connection' are automatically queued and sent when reconnected
- **Typed event system** - Send and subscribe to predefined messages

```typescript
import { makeSocket } from 'sox';

interface EventMap {
  send: {
    chat: { message: string };
  };
  on: {
    messageReceived: { text: string; user: string };
    typing: { user: string };
  };
}

const socket = makeSocket<EventMap>({
  url: 'wss://server.com/socket',
  maxRetries: 5
});

// Send messages. Messages sent in 'reconnection' or 'connection' state are sent on websocket opened.
socket.send('chat', { message: 'Hello, world!' });

// Listen for events. Returns unsubscribe function.
const unsubscribe = socket.on('messageReceived', doSomthing);

// Remove all listeners of specified event.
socket.removeListeners('messageReceived');

// Handle meta events
socket.on('connected', console.log);
socket.on('disconnected', console.log);

// Close the socket
socket.disconnect();
````
