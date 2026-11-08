// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MenuMealLogger from "../components/MenuMealLogger";
import MealResultCard from "../components/MealResultCard";

const menu = {
  available: true,
  meal: "lunch",
  meals: [
    { meal: "breakfast", hours: "7:00 AM to 9:00 AM", state: "closed", logged: true },
    { meal: "lunch", hours: "11:30 AM to 2:00 PM", state: "open", logged: false },
    { meal: "snacks", hours: "4:30 PM to 6:00 PM", state: "upcoming", logged: false },
    { meal: "dinner", hours: "7:30 PM to 9:30 PM", state: "upcoming", logged: false },
  ],
  foods: [
    { name: "Roti", unit: "piece", calories: 86, proteinG: 3.2, carbsG: 17.5, fatG: 0.4, source: "ifct", start: 2, step: 1, lastQuantity: 3 },
    { name: "Dal", unit: "katori", calories: 84, proteinG: 5.2, carbsG: 14, fatG: 1.8, source: "ifct", start: 1, step: 0.5, lastQuantity: null },
    { name: "Aloo Sabzi", unit: "katori", calories: 160, proteinG: 3, carbsG: 22, fatG: 7, source: "estimated", start: 1, step: 0.5, lastQuantity: null },
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

async function mountLogger(fetchMock = vi.fn().mockResolvedValue(json(menu))) {
  vi.stubGlobal("fetch", fetchMock);
  const handlers = { onLogged: vi.fn(), onUnavailable: vi.fn(), onError: vi.fn() };
  render(<MenuMealLogger {...handlers} />);
  if (fetchMock.mock.results.length) await screen.findByText("What did you take?").catch(() => null);
  return { fetchMock, ...handlers };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Menu meal logging", () => {
  it("assumes nothing: no food starts selected and saving is off", async () => {
    await mountLogger();
    for (const button of screen.getAllByRole("button", { pressed: false })) {
      expect(button.textContent).not.toContain("kcal ·");
    }
    expect((screen.getByText("Tap what you took") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the last amount as a hint, then starts from it when tapped", async () => {
    await mountLogger();
    expect(screen.getByText("Last time: 3 piece")).toBeTruthy();

    fireEvent.click(screen.getByText("Roti"));
    expect(screen.getByText("3 pc")).toBeTruthy();
    expect(screen.getByText("258 kcal · 9.6g protein")).toBeTruthy();
  });

  it("lets the user change the amount in either direction", async () => {
    await mountLogger();
    fireEvent.click(screen.getByText("Dal"));
    fireEvent.click(screen.getByLabelText("More Dal"));
    expect(screen.getByText("1.5 katori")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Less Dal"));
    fireEvent.click(screen.getByLabelText("Less Dal"));
    expect(screen.getByText("0.5 katori")).toBeTruthy();
  });

  it("removes a food when its amount reaches zero", async () => {
    await mountLogger();
    fireEvent.click(screen.getByText("Dal"));
    fireEvent.click(screen.getByLabelText("Less Dal"));
    fireEvent.click(screen.getByLabelText("Less Dal"));
    expect(screen.queryByLabelText("Less Dal")).toBeNull();
  });

  it("saves only what was tapped, with the right totals", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(menu)).mockResolvedValueOnce(json({ event: {} }, 201));
    const { onLogged } = await mountLogger(fetchMock);

    fireEvent.click(screen.getByText("Roti"));
    fireEvent.click(screen.getByText("Aloo Sabzi"));
    fireEvent.click(screen.getByText(/^Log Lunch/));

    await waitFor(() => expect(onLogged).toHaveBeenCalled());
    const { type, payload } = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(type).toBe("meal");
    expect(payload.mealType).toBe("lunch");
    expect(payload.totalCalories).toBe(418);
    expect(payload.totalProteinG).toBe(12.6);
    expect(payload.foods.map((food: { name: string }) => food.name)).toEqual(["Roti", "Aloo Sabzi"]);
    expect(payload.foods[1].estimated).toBe(true);
  });

  it("falls back when there is no menu", async () => {
    const { onUnavailable } = await mountLogger(vi.fn().mockResolvedValue(json({ available: false })));
    await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
  });

  it("reports a failed save and doesn't claim success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(menu)).mockResolvedValueOnce(json({ error: "Nope" }, 400));
    const { onError, onLogged } = await mountLogger(fetchMock);

    fireEvent.click(screen.getByText("Dal"));
    fireEvent.click(screen.getByText(/^Log Lunch/));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Nope"));
    expect(onLogged).not.toHaveBeenCalled();
  });
});

describe("Meal result card", () => {
  it("shows the saved values, even for a dish IFCT also knows by name", () => {
    render(
      <MealResultCard
        food={{ name: "Rice", dishName: "rice_cooked", quantity: 1, unitType: "plate", estimatedCalories: 912, proteinG: 41.5, weightGrams: 700 }}
        onQuantityChange={() => {}}
        onRemove={() => {}}
      />
    );
    expect(screen.getByText("912 kcal")).toBeTruthy();
    expect(screen.getByText("41.5g protein")).toBeTruthy();
    expect(screen.queryByText("Not in database")).toBeNull();
  });
});
