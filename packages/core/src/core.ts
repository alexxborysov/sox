export interface Config {
  url: string;
  protocols?: string | string[];
  maxRetries?: number;
}

export type InternalEvents = {
  connected: null;
  disconnected: { clean: boolean };
  reconnecting: { attempt: number; delay: number };
  maxRetriesExceeded: { maxRetries: number };
};

export type EventMap = { send: unknown; on: unknown };
export type EventMapWithInternals<EM extends EventMap> = EM & {
  on: EM["on"] & InternalEvents;
};

type ListenersMap<EventMap> = {
  [Message in keyof EventMap]?: Array<(payload: EventMap[Message]) => void>;
};

export function makeSocket<EM extends EventMap>(config: Config) {
  const { url, protocols, maxRetries = 3 } = config;

  let socket: WebSocket | null = null;
  let connectionAttempt = 0;
  let isConnecting = false;
  let listeners: ListenersMap<EventMapWithInternals<EM>["on"]> = {};
  let connection = Promise.withResolvers<void>();

  function createSocket() {
    if (isConnecting) return;
    isConnecting = true;
    connectionAttempt++;

    if (
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();
    }

    socket = new WebSocket(url, protocols);

    socket.addEventListener("open", () => {
      isConnecting = false;
      connectionAttempt = 0;
      connection.resolve();
      triggerEvent("connected", null);
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type || "message";
        triggerEvent(eventType, data);
      } catch (e) {
        triggerEvent("message", event.data);
      }
    });

    socket.addEventListener("close", (event) => {
      isConnecting = false;

      if (!event.wasClean && connectionAttempt < maxRetries) {
        const exponentialDelay = Math.min(1000 * Math.pow(2, connectionAttempt - 1), 30000);
        triggerEvent("reconnecting", { attempt: connectionAttempt, delay: exponentialDelay });

        setTimeout(() => {
          connection = Promise.withResolvers<void>();
          createSocket();
        }, exponentialDelay);
      } else if (connectionAttempt >= maxRetries) {
        connection.reject(new Error(`Failed to connect after ${maxRetries} attempts`));
        triggerEvent("maxRetriesExceeded", { maxRetries });
      } else {
        triggerEvent("disconnected", { clean: event.wasClean });
      }
    });

    socket.addEventListener("error", (error) => {
      triggerEvent("error", error);
    });
  }

  function triggerEvent<EventType extends keyof EventMapWithInternals<EM>["on"]>(
    eventType: EventType,
    data: EventMapWithInternals<EM>["on"][EventType]
  ) {
    if (listeners[eventType]) {
      listeners[eventType]?.forEach((callback) => callback(data));
    }
  }

  async function send<Message extends keyof EM["send"]>(
    messageType: Message,
    payload: EM["send"][Message]
  ) {
    await connection.promise;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: messageType,
          data: payload,
        })
      );
    }
  }

  function on<Event extends keyof EventMapWithInternals<EM>["on"]>(
    eventType: Event,
    callback: (data: EventMapWithInternals<EM>["on"][Event]) => void
  ) {
    if (!listeners[eventType]) {
      listeners[eventType] = [];
    }

    listeners[eventType]?.push(callback);

    function unsubscribe() {
      const callbackList = listeners[eventType];
      if (callbackList) {
        listeners[eventType] = callbackList.filter((cb) => cb !== callback);
      }
    }

    return unsubscribe;
  }

  function removeListeners<Event extends keyof EventMapWithInternals<EM>["on"]>(
    eventType: Event
  ) {
    listeners[eventType] = [];
  }

  function disconnect() {
    if (socket) socket.close();
  }

  createSocket();

  return {
    on,
    send,
    removeListeners,
    disconnect,
  };
}

// Usage
type EventMapExample = {
  send: {
    set_listen_room: {
      p: 12;
      message: "set_listen_room";
      data: {
        room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed";
      };
    };
  };
  on: {
    event_a: {
      p: 500;
      message: "event_a";
      data: {
        hello: "world";
      };
    };
  };
};

const socket = makeSocket<EventMapExample>({ url: "wss://localhost:3000", maxRetries: 5 });
socket.send("set_listen_room", {
  p: 12,
  message: "set_listen_room",
  data: {
    room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed",
  },
});
const unsub = socket.on("event_a", (a) => {
  a.data.hello;
});
unsub();
socket.on("maxRetriesExceeded", () => {});

socket.removeListeners("event_a");
socket.removeListeners("maxRetriesExceeded");
socket.disconnect();
