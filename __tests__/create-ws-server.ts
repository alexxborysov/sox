import { delay, WebSocketHandlerConnection, ws } from "msw";
import { setupServer } from "msw/node";

export function createWsServer(
  options: {
    link?: string;
    on_connection?: (client: WebSocketHandlerConnection["client"]) => void;
    on_message?: (data: string, client: WebSocketHandlerConnection["client"]) => void;
    on_close?: (closeEv: CloseEvent) => void;
  } = {}
) {
  const { link = "ws://localhost:7777", on_close, on_message, on_connection } = options;
  const handler = ws.link(link);
  const server = setupServer(
    handler.addEventListener("connection", ({ client }) => {
      on_connection?.(client);
      client.addEventListener("message", ({ data }) => {
        on_message?.(data.toString(), client);
      });
      client.addEventListener("close", (ev) => on_close?.(ev));
    })
  );

  return {
    link,
    start: server.listen.bind(server),
    finish: server.close.bind(server),
    _server: server,
  };
}
