// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ReminderSettings from "../components/ReminderSettings";

describe("Meal reminder buttons", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "granted" });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ success: true })
        : Response.json({ publicKey: "key", enabled: true, meals: ["breakfast", "lunch", "snacks"] })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("says plainly whether each meal is on or off", async () => {
    render(<ReminderSettings />);
    expect(await screen.findByRole("button", { name: "snacks · On" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "dinner · Off" })).toBeTruthy();
  });

  it("switches a meal on and saves it", async () => {
    render(<ReminderSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "dinner · Off" }));

    expect(await screen.findByRole("button", { name: "dinner · On" })).toBeTruthy();
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toEqual({ action: "meals", meals: ["breakfast", "lunch", "snacks", "dinner"] });
  });
});
