export interface Config {
  url: string;
  protocols?: string | string[];
  reconnection?: {
    maxRetries: number;
    excludedCloseCode: number[];
  };
  debug?: boolean;
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

export type SocketStatus = "unknown" | "open" | "connecting" | "closing" | "closed";
export const CLOSED_FROM_CLIENT_REASON = "CLOSED_FROM_CLIENT_REASON";
export const NORMALLY_CLOSED_CODE = 1000;

export function makeSocket<EM extends EventMap>(config: Config) {
  const {
    url,
    protocols,
    reconnection = { maxRetries: 3, excludedCloseCode: [NORMALLY_CLOSED_CODE, 1005] },
    debug = false,
  } = config;
  const meta = {
    connectionAttempt: 0,
    isConnecting: false,
  };

  let socket: WebSocket | null = null;
  let queue = [] as Array<VoidFunction>;
  let listeners: ListenersMap<EventMapWithInternals<EM>["on"]> = {};

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

    socket.addEventListener("open", (event) => {
      meta.isConnecting = false;
      meta.connectionAttempt = 0;
      sendQueuedMessages();
      triggerEvent("connected");
      log(event, debug);
    });

    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data);
        const eventType = payload.message || "message";
        triggerEvent(eventType, payload);
      } catch {
        triggerEvent("message", event.data);
      }
      log(event, debug);
    });

    socket.addEventListener("close", (event) => {
      meta.isConnecting = false;
      const shouldReconnect =
        !reconnection.excludedCloseCode.includes(event.code) &&
        event.reason !== CLOSED_FROM_CLIENT_REASON &&
        meta.connectionAttempt < reconnection?.maxRetries;
      const maxRetriesExceeded =
        shouldReconnect && meta.connectionAttempt >= reconnection.maxRetries;

      if (shouldReconnect) {
        const exponentialDelay = getExponentialDelay(meta.connectionAttempt);
        triggerEvent("reconnecting", {
          attempt: meta.connectionAttempt,
          delay: exponentialDelay,
        });
        setTimeout(() => createSocketConnection(), exponentialDelay);
      } else if (maxRetriesExceeded) {
        triggerEvent("maxRetriesExceeded", { maxRetries: reconnection.maxRetries });
      } else {
        triggerEvent("disconnected", {
          code: event.code,
          reason: event.reason,
          clean: event.wasClean,
        });
      }
      log(event, debug);
    });

    socket.addEventListener("error", (error) => {
      triggerEvent("error", error);
      log(error, debug);
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

  function removeAllListeners() {
    listeners = {};
    queue = [];
  }

  function close(meta?: { code?: number; reason?: string }) {
    if (socket) {
      socket.close(
        meta?.code ?? NORMALLY_CLOSED_CODE,
        meta?.reason ?? CLOSED_FROM_CLIENT_REASON
      );
    }
  }

  function getStatus(): SocketStatus {
    if (!socket?.readyState) {
      return "unknown";
    }
    const statuses = ["connecting", "open", "closing", "closed"] satisfies Array<
      Exclude<SocketStatus, "unkown">
    >;
    return statuses[socket.readyState];
  }

  return {
    on,
    send,
    removeListeners,
    removeAllListeners,
    close,
    connect: createSocketConnection,
    getStatus,
  };
}

function getExponentialDelay(attempt: number) {
  return Math.min(1000 * Math.pow(2, attempt - 1), 7_000);
}

function log(value: unknown, debug: boolean) {
  if (debug) {
    console.log("SSOX Debug:", value);
  }
}
