export interface Config {
  url: string;
  protocols?: string | string[];
  maxRetries?: number;
}

export type InternalEvents = {
  connected: void;
  disconnected: { clean: boolean; reason: string; code: number };
  reconnecting: { attempt: number; delay: number };
  maxRetriesExceeded: { maxRetries: number };
};

export type EventMap = { send: any; on: any };
export type EventMapWithInternals<EM extends EventMap> = EM & {
  on: EM["on"] & InternalEvents;
};

type ListenersMap<EventMap> = {
  [Message in keyof EventMap]?: Array<(payload: EventMap[Message]) => void>;
};

export const CLOSED_FROM_CLIENT_REASON = "CLOSED_FROM_CLIENT_REASON";
export const NORMALLY_CLOSED_CODE = 1000;

export function makeSocket<EM extends EventMap>(config: Config) {
  const { url, protocols, maxRetries = 3 } = config;
  const meta = {
    connectionAttempt: 0,
    isConnecting: false,
  };

  let socket: WebSocket | null = null;
  let queue = [] as Array<VoidFunction>;
  const listeners: ListenersMap<EventMapWithInternals<EM>["on"]> = {};

  function createSocketConnection() {
    if (meta.isConnecting) return;
    meta.isConnecting = true;
    meta.connectionAttempt++;

    if (
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close();
    }

    socket = new WebSocket(url, protocols);

    socket.addEventListener("open", () => {
      meta.isConnecting = false;
      meta.connectionAttempt = 0;
      sendQueuedMessages();
      triggerEvent("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const eventType = payload.message || "message";
        triggerEvent(eventType, payload);
      } catch {
        triggerEvent("message", event.data);
      }
    });

    socket.addEventListener("close", (event) => {
      meta.isConnecting = false;
      const shouldReconnect =
        event.code !== NORMALLY_CLOSED_CODE &&
        event.reason !== CLOSED_FROM_CLIENT_REASON &&
        meta.connectionAttempt < maxRetries;
      const maxRetriesExceeded = shouldReconnect && meta.connectionAttempt >= maxRetries;

      if (shouldReconnect) {
        const exponentialDelay = getExponentialDelay(meta.connectionAttempt);
        triggerEvent("reconnecting", {
          attempt: meta.connectionAttempt,
          delay: exponentialDelay,
        });
        setTimeout(() => createSocketConnection(), exponentialDelay);
      } else if (maxRetriesExceeded) {
        triggerEvent("maxRetriesExceeded", { maxRetries });
      } else {
        triggerEvent("disconnected", {
          clean: event.wasClean,
          reason: event.reason,
          code: event.code,
        });
      }
    });

    socket.addEventListener("error", (error) => {
      triggerEvent("error", error);
    });
  }

  function triggerEvent<EventType extends keyof EventMapWithInternals<EM>["on"]>(
    eventType: EventType,
    data?: EventMapWithInternals<EM>["on"][EventType]
  ) {
    if (listeners[eventType]) {
      listeners[eventType]?.forEach((callback) => callback(data));
    }
  }

  async function send<Message extends keyof EM["send"]>(
    _message: Message,
    payload: EM["send"][Message]
  ) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      queue.push(() => socket?.send(JSON.stringify(payload)));
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

  function sendQueuedMessages() {
    queue.forEach((sender) => sender());
    queue = [];
  }

  function removeListeners<Event extends keyof EventMapWithInternals<EM>["on"]>(
    eventType: Event
  ) {
    listeners[eventType] = [];
  }

  function close() {
    if (socket) socket.close(NORMALLY_CLOSED_CODE, CLOSED_FROM_CLIENT_REASON);
  }

  return {
    on,
    send,
    removeListeners,
    close,
    connect: createSocketConnection,
  };
}

function getExponentialDelay(attempt: number) {
  return Math.min(1000 * Math.pow(2, attempt - 1), 7_000);
}
