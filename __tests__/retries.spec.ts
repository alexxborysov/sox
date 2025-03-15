import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { makeSocket } from "~/core/src/core";
