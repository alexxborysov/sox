import { describe, it, expect, vi } from "vitest";
import { makeSocket } from "../packages/core/src/main";
import { createWsServer } from "./create-ws-server";
import { delay } from "msw";

describe("reconnection", () => {
  it("should send message fired in reconnection state", async () => {
    const PAYLOAD = {
      message: "set_listen_room",
      data: {
        room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed",
      },
    } as const;

    const serverMessageHandler = vi.fn((payload: string) => {
      expect(JSON.parse(payload)).toStrictEqual(PAYLOAD);
    });

    let shouldClose = true;
    const server = createWsServer({
      on_connection: (client) => {
        if (shouldClose) {
          shouldClose = false;
          client.close(1006);
        }
      },
      on_message: serverMessageHandler,
    });

    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });

    socket.send("set_listen_room", PAYLOAD);
    socket.send("set_listen_room", PAYLOAD);

    await delay(1500);

    expect(serverMessageHandler).toHaveBeenCalledTimes(2);

    socket.disconnect();
  });

  it("should handle multiple server disconnections", async () => {
    const PAYLOAD = {
      message: "set_listen_room",
      data: {
        room: "e23c64ca-0e9c-482d-a7ae-c7413bb7bbed",
      },
    } as const;

    const serverMessageHandler = vi.fn((payload: string) => {
      expect(JSON.parse(payload)).toStrictEqual(PAYLOAD);
    });

    let connectionCount = 0;
    const server = createWsServer({
      on_connection: (client) => {
        if (connectionCount < 2) {
          connectionCount++;
          client.close(1006);
        }
      },
      on_message: serverMessageHandler,
    });
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });

    socket.send("set_listen_room", PAYLOAD);
    socket.send("set_listen_room", PAYLOAD);
    await delay(3000);

    socket.send("set_listen_room", PAYLOAD);
    await delay(1000);

    expect(serverMessageHandler).toHaveBeenCalledTimes(3);
    expect(connectionCount).toBe(2);

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
