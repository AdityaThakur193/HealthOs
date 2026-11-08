// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkoutPlanBuilder from "../components/WorkoutPlanBuilder";
import { buildTemplateWeek, getExerciseLibrary } from "../lib/workoutPlans";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const planResponse = (isCustom = false) => ({
  week: buildTemplateWeek(4),
  template: buildTemplateWeek(4),
  isCustom,
  library: getExerciseLibrary(),
});

async function open(fetchMock = vi.fn().mockResolvedValue(json(planResponse()))) {
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(<WorkoutPlanBuilder onSaved={onSaved} onClose={onClose} />);
  fireEvent.click(await screen.findByRole("button", { name: "Tue" }));
  return { fetchMock, onSaved, onClose };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Workout plan builder", () => {
  it("opens with the template already filled in", async () => {
    await open();
    expect((screen.getByLabelText("Day Name") as HTMLInputElement).value).toBe("Tuesday — Upper A");
    expect(screen.getByText("Starting from the default template.")).toBeTruthy();
  });

  it("adds from the library, and offers a new exercise when none match", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Find an exercise"), { target: { value: "hammer" } });
    fireEvent.click(screen.getByText(/Dumbbell Hammer Curl/));
    expect(screen.getByLabelText("Remove Dumbbell Hammer Curl")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Find an exercise"), { target: { value: "Sled Push" } });
    fireEvent.click(screen.getByText('Add "Sled Push" as my own exercise'));
    expect(screen.getByLabelText("Remove Sled Push")).toBeTruthy();
  });

  it("saves changes to sets and removals", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(planResponse())).mockResolvedValueOnce(json({ week: {}, isCustom: true }));
    const { onSaved, onClose } = await open(fetchMock);

    fireEvent.click(screen.getByLabelText("Remove Incline Dumbbell Press"));
    fireEvent.click(screen.getByLabelText("More sets of Cable Rope Pushdown"));
    fireEvent.click(screen.getByText("Save My Plan"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
    const { plan } = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(plan[2].exercises.some((item: { id: string }) => item.id === "incline_db_press")).toBe(false);
    expect(plan[2].exercises.find((item: { id: string }) => item.id === "rope_pushdown").targetSets).toBe(4);
  });

  it("keeps the builder open and shows the problem if saving fails", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(planResponse())).mockResolvedValueOnce(json({ error: "Give this training day a name." }, 400));
    const { onClose } = await open(fetchMock);

    fireEvent.click(screen.getByText("Save My Plan"));

    expect(await screen.findByText("Give this training day a name.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks before replacing someone's own plan with the template", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(planResponse(true)));
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    await open(fetchMock);

    fireEvent.click(screen.getByText("Reset to the default template"));

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
