# ssox

A client-side declarative WebSocket abstraction.

- **Reconnection** - Configurable reconnection flow with exponential backoff.
- **Message queuing** - Messages sent during 'reconnection' / 'connection' are automatically queued and sent when reconnected
- **Typed event system** - Send and subscribe to predefined messages

```typescript
import { makeSocket } from 'ssox';

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
  reconnection: {
    maxRetries: 7,
    // Excluded codes from reconnection flow by default: [1000, 1005].
    // Following property will override defaults.
    excludedCloseCode: [3006],
  },
  dedug: true,
});

// Connection management. Connection will be created only when .connect() called.
socket.connect()
socket.close();

// Send messages. Messages sent in 'reconnection' or 'connection' state are sent on websocket opened.
socket.send('chat', { message: 'Hello, world!' });

// Listen for events. Returns unsubscribe function.
socket.on('typing', doSomething);
const unsubscribe = socket.on('messageReceived', doSomething);

// Remove  listeners of specified event.
socket.removeListeners('messageReceived');

// Remove all listeners.
socket.removeAllListeners();

// Handle meta events
socket.on('connected', console.log);
socket.on('disconnected', console.log);
````
