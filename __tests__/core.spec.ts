import { describe, it, expect, vi } from "vitest";
import { makeSocket } from "../packages/core/src/main";
import { createWsServer } from "./create-ws-server";
import { delay } from "msw";

describe("core", () => {
  it(".on", async () => {
    const PAYLOAD = {
      message: "event_a",
      data: { hello: "world" },
    } as const;

    const clientHandler = vi.fn((payload: EventMapExample["on"]["event_a"]) => {
      expect(payload).toEqual(PAYLOAD);
    });

    const server = createWsServer({
      on_connection: (client) => {
        client.send(JSON.stringify(PAYLOAD));
      },
    });
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });
    socket.on("event_a", clientHandler);

    await socket.connected;
    expect(clientHandler).toHaveBeenCalledTimes(1);

    socket.disconnect();
  });

  it("should handle sending messages to server", async () => {
    const PAYLOAD = {
      message: "set_listen_room",
      data: {
        room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed",
      },
    } as const;

    const serverMessageHandler = vi.fn((payload: string) => {
      expect(JSON.parse(payload)).toStrictEqual(PAYLOAD);
    });

    const server = createWsServer({
      on_message: serverMessageHandler,
    });

    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });

    socket.send("set_listen_room", PAYLOAD);
    socket.send("set_listen_room", PAYLOAD);

    await delay(200);
    expect(serverMessageHandler).toHaveBeenCalledTimes(2);

    socket.disconnect();
  });

  it("should handle reconnection when server disconnects", async () => {
    let shouldClose = true;
    const server = createWsServer({
      on_connection: (client) => {
        if (shouldClose) {
          shouldClose = false;
          client.close(1006);
        }
      },
    });
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
      maxRetries: 2,
    });

    const reconnectingHandler = vi.fn();
    const connectedHandler = vi.fn(() => {
      expect(connectedHandler).toHaveBeenCalledTimes(1);
      expect(reconnectingHandler).toHaveBeenCalledTimes(1);
    });

    socket.on("reconnecting", reconnectingHandler);
    socket.on("connected", connectedHandler);

    socket.disconnect();
  });
});

interface EventMapExample {
  send: {
    set_listen_room: {
      message: "set_listen_room";
      data: {
        room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed";
      };
    };
  };
  on: {
    event_a: {
      message: "event_a";
      data: {
        hello: "world";
      };
    };
  };
}
