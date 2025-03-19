import { describe, it, expect, vi } from "vitest";
import {
  CLOSED_FROM_CLIENT_REASON,
  makeSocket,
  NORMALLY_CLOSED_CODE,
} from "../packages/core/src/main";
import { createWsServer } from "./create-ws-server";
import { delay } from "msw";

describe(".close", () => {
  it("should pass reason", async () => {
    const server = createWsServer();
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });
    socket.connect();

    const closeHandler = vi.fn((meta: { clean: boolean; reason: string }) => {
      expect(meta).toBeDefined();
      expect(meta.reason).toBe(CLOSED_FROM_CLIENT_REASON);
    });

    socket.on("disconnected", closeHandler);

    socket.close();
    await delay(50);
    expect(closeHandler).toHaveBeenCalledOnce();
  });

  it("should not reconnect", async () => {
    const server = createWsServer({
      on_connection: (client) => {
        client.close(NORMALLY_CLOSED_CODE);
      },
    });
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });
    socket.connect();

    const closeHandler = vi.fn((meta: unknown) => {
      expect(meta).toBeDefined();
      expect(meta).toStrictEqual({ clean: true, reason: "" });
    });

    socket.on("disconnected", closeHandler);

    await delay(50);
    expect(closeHandler).toHaveBeenCalledOnce();
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
