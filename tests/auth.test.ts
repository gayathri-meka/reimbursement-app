import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
} from "@/lib/auth";

describe("Auth", () => {
  describe("hashPassword / verifyPassword", () => {
    it("hashes and verifies a password correctly", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);

      const valid = await verifyPassword(password, hash);
      expect(valid).toBe(true);
    });

    it("rejects wrong password", async () => {
      const hash = await hashPassword("correct-password");
      const valid = await verifyPassword("wrong-password", hash);
      expect(valid).toBe(false);
    });
  });

  describe("signToken / verifyToken", () => {
    it("signs and verifies a JWT token", async () => {
      const payload = {
        employeeId: "test-id-123",
        email: "test@example.com",
        role: "EMPLOYEE",
      };

      const token = await signToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = await verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.employeeId).toBe(payload.employeeId);
      expect(decoded!.email).toBe(payload.email);
      expect(decoded!.role).toBe(payload.role);
    });

    it("returns null for invalid token", async () => {
      const decoded = await verifyToken("invalid-token-string");
      expect(decoded).toBeNull();
    });

    it("returns null for tampered token", async () => {
      const token = await signToken({
        employeeId: "id",
        email: "a@b.com",
        role: "ADMIN",
      });
      // Tamper with the token
      const tampered = token.slice(0, -5) + "XXXXX";
      const decoded = await verifyToken(tampered);
      expect(decoded).toBeNull();
    });
  });

  describe("setAuthCookie", () => {
    it("returns correct cookie config with the token value", () => {
      const cookie = setAuthCookie("my-jwt-token");
      expect(cookie.name).toBe("auth-token");
      expect(cookie.value).toBe("my-jwt-token");
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("lax");
      expect(cookie.path).toBe("/");
      expect(cookie.maxAge).toBe(60 * 60 * 24 * 7); // 7 days
    });

    it("sets secure flag based on NODE_ENV", () => {
      const cookie = setAuthCookie("token");
      // In test environment, NODE_ENV is not "production"
      expect(cookie.secure).toBe(false);
    });
  });

  describe("clearAuthCookie", () => {
    it("returns cookie config with empty value and maxAge 0", () => {
      const cookie = clearAuthCookie();
      expect(cookie.name).toBe("auth-token");
      expect(cookie.value).toBe("");
      expect(cookie.maxAge).toBe(0);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.path).toBe("/");
    });
  });
});
