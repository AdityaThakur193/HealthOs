import { ITimelineEvent } from "./db/models";

export interface ConsolidatedWaterPayload {
  amountL: number;
  isConsolidated: boolean;
  originalEventIds: string[];
  subEvents: any[];
}

export type GroupedEvents = [string, (ITimelineEvent | any)[]][];

/**
 * Groups timeline events by date string and consolidates multiple water events into single entries
 */
export function getGroupedEvents(events: ITimelineEvent[]): GroupedEvents {
  const groups: Record<string, ITimelineEvent[]> = {};

  // Sort events descending first so they display newest first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  sortedEvents.forEach((event) => {
    const dateStr = new Date(event.timestamp).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(event);
  });

  // Consolidate water logs for each date group
  const consolidatedGroups: GroupedEvents = Object.entries(groups).map(([dateStr, dayEvents]) => {
    const waterEvents = dayEvents.filter((e) => e.type === "water");
    const nonWater = dayEvents.filter((e) => e.type !== "water");

    if (waterEvents.length > 0) {
      // Sum total water amount
      const totalAmount = waterEvents.reduce((sum, e) => {
        const p = e.payload as any;
        const amt = Number(p?.amountL || p?.waterL || (p?.amountMl ? p.amountMl / 1000 : 0)) || 0;
        return sum + amt;
      }, 0);
      // Create a consolidated water event
      const consolidatedWaterEvent = {
        _id: `consolidated_water_${dateStr}`,
        type: "water",
        timestamp: waterEvents[0].timestamp, // use the latest timestamp
        payload: {
          amountL: Math.round(totalAmount * 10) / 10,
          isConsolidated: true,
          originalEventIds: waterEvents.map((e) => String(e._id || (e as any).id)),
          subEvents: waterEvents, // store references to show inside the editor
        },
      };
      // Put the water event at the end or maintain sort
      return [dateStr, [...nonWater, consolidatedWaterEvent]];
    }

    return [dateStr, dayEvents];
  });

  return consolidatedGroups;
}
