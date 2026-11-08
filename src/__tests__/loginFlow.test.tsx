// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Login from "../app/login/page";
import SessionWatcher from "../components/SessionWatcher";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Same behaviour as Storage: stored keys are the object's own enumerable keys. */
function createStorage() {
  return Object.defineProperties({} as Record<string, string> & Storage, {
    getItem: { value(this: Record<string, string>, key: string) { return this[key] ?? null; } },
    setItem: { value(this: Record<string, string>, key: string, value: string) { this[key] = String(value); } },
    removeItem: { value(this: Record<string, string>, key: string) { delete this[key]; } },
  });
}

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal("localStorage", createStorage());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submitEmailThenCode(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  render(<Login />);

  fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "User@Example.com" } });
  fireEvent.click(screen.getByText("Send Login Code"));

  const codeInput = await screen.findByPlaceholderText("123456");
  fireEvent.change(codeInput, { target: { value: "123456" } });
  fireEvent.click(screen.getByText("Verify & Enter"));
}

describe("Login page", () => {
  it("signs in an existing user and goes to the dashboard", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, email: "user@example.com", userId: "abc" }));

    await submitEmailThenCode(fetchMock);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem("healthos_userId")).toBe("abc");

    const verifyBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(verifyBody.tz).toBeTruthy();
    expect(verifyBody.hash).toBeUndefined();
  });

  it("sends a new user to onboarding", async () => {
    await submitEmailThenCode(
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(jsonResponse({ success: true, email: "user@example.com", userId: null }))
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding?email=user%40example.com"));
  });

  it("shows the error for a wrong code and stays on the page", async () => {
    await submitEmailThenCode(
      vi.fn()
        .mockResolvedValueOnce(jsonResponse({ success: true }))
        .mockResolvedValueOnce(jsonResponse({ error: "Invalid or expired code" }, 401))
    );
    expect(await screen.findByText("Invalid or expired code")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("SessionWatcher", () => {
  function mountWithFetch(status: number) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/meal", assign });
    render(<SessionWatcher />);
    return assign;
  }

  it("clears local identity and redirects when an API call returns 401", async () => {
    localStorage.setItem("healthos_email", "a@b.co");
    const assign = mountWithFetch(401);

    await window.fetch("/api/timeline");

    expect(assign).toHaveBeenCalledWith("/login");
    expect(localStorage.getItem("healthos_email")).toBeNull();
  });

  it("ignores wrong-code responses from the auth routes", async () => {
    const assign = mountWithFetch(401);
    await window.fetch("/api/auth/verify-otp");
    expect(assign).not.toHaveBeenCalled();
  });

  it("does nothing on success", async () => {
    const assign = mountWithFetch(200);
    await window.fetch("/api/timeline");
    expect(assign).not.toHaveBeenCalled();
  });
});
