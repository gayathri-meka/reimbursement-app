import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

// Mock next/server before importing middleware
vi.mock("next/server", () => {
  class MockNextResponse {
    static _lastRedirectUrl: string | null = null;
    static _nextCalled = false;

    static redirect(url: URL) {
      MockNextResponse._lastRedirectUrl = url.toString();
      return { type: "redirect", url: url.toString() };
    }

    static next() {
      MockNextResponse._nextCalled = true;
      return { type: "next" };
    }

    static _reset() {
      MockNextResponse._lastRedirectUrl = null;
      MockNextResponse._nextCalled = false;
    }
  }

  return { NextRequest: vi.fn(), NextResponse: MockNextResponse };
});

import { NextResponse } from "next/server";
import { middleware } from "@/middleware";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

async function createToken(role: string) {
  return new SignJWT({ employeeId: "emp-1", email: "test@test.com", role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

function makeRequest(pathname: string, token?: string) {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: (name: string) => {
        if (name === "auth-token" && token) {
          return { value: token };
        }
        return undefined;
      },
    },
  } as any;
}

describe("Middleware", () => {
  beforeEach(() => {
    (NextResponse as any)._reset();
  });

  describe("public paths", () => {
    it("allows /login without authentication", async () => {
      const result = await middleware(makeRequest("/login"));
      expect(result.type).toBe("next");
    });

    it("allows /api/auth/login without authentication", async () => {
      const result = await middleware(makeRequest("/api/auth/login"));
      expect(result.type).toBe("next");
    });
  });

  describe("static / internal paths", () => {
    it("allows /_next paths", async () => {
      const result = await middleware(makeRequest("/_next/static/chunk.js"));
      expect(result.type).toBe("next");
    });

    it("allows /favicon paths", async () => {
      const result = await middleware(makeRequest("/favicon.ico"));
      expect(result.type).toBe("next");
    });

    it("allows root path /", async () => {
      const result = await middleware(makeRequest("/"));
      expect(result.type).toBe("next");
    });
  });

  describe("unauthenticated access", () => {
    it("redirects to /login when no token is present", async () => {
      const result = await middleware(makeRequest("/employee/dashboard"));
      expect(result.type).toBe("redirect");
      expect(result.url).toContain("/login");
    });

    it("redirects to /login for admin routes without token", async () => {
      const result = await middleware(makeRequest("/admin/dashboard"));
      expect(result.type).toBe("redirect");
      expect(result.url).toContain("/login");
    });
  });

  describe("role-based access", () => {
    it("allows EMPLOYEE to access /employee routes", async () => {
      const token = await createToken("EMPLOYEE");
      const result = await middleware(makeRequest("/employee/dashboard", token));
      expect(result.type).toBe("next");
    });

    it("allows ADMIN to access /admin routes", async () => {
      const token = await createToken("ADMIN");
      const result = await middleware(makeRequest("/admin/dashboard", token));
      expect(result.type).toBe("next");
    });

    it("redirects EMPLOYEE away from /admin routes", async () => {
      const token = await createToken("EMPLOYEE");
      const result = await middleware(makeRequest("/admin/dashboard", token));
      expect(result.type).toBe("redirect");
      expect(result.url).toContain("/employee/dashboard");
    });

    it("redirects ADMIN away from /employee routes", async () => {
      const token = await createToken("ADMIN");
      const result = await middleware(makeRequest("/employee/dashboard", token));
      expect(result.type).toBe("redirect");
      expect(result.url).toContain("/admin/dashboard");
    });
  });

  describe("invalid token", () => {
    it("redirects to /login with an invalid JWT", async () => {
      const result = await middleware(
        makeRequest("/employee/dashboard", "invalid-jwt-token")
      );
      expect(result.type).toBe("redirect");
      expect(result.url).toContain("/login");
    });
  });
});
