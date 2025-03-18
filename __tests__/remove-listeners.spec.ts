import { describe, it, expect, vi } from "vitest";
import { makeSocket } from "../packages/core/src/main";
import { createWsServer } from "./create-ws-server";
import { delay } from "msw";

describe(".remove-listeners", () => {
  it("should not handle messages after listeners removed", async () => {
    const INTERVAL = 50;
    const PAYLOAD = {
      message: "event_a",
      data: {
        hello: "world",
      },
    } as const;

    const server = createWsServer({
      on_connection: (client) => {
        setInterval(() => {
          client.send(JSON.stringify(PAYLOAD));
        }, INTERVAL);
      },
    });
    server.start();

    const socket = makeSocket<EventMapExample>({
      url: server.link,
    });
    socket.connect();

    const clientHandler = vi.fn((payload: unknown) => {
      expect(payload).toStrictEqual(PAYLOAD);
    });

    socket.on("event_a", clientHandler);

    await delay(INTERVAL * 2 + 10);
    socket.removeListeners("event_a");

    await delay(150);
    expect(clientHandler).toHaveBeenCalledTimes(2);

    server.finish();
    socket.close();
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
