import type { Trip } from "./types";

const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Download the whole itinerary as an .ics file (Google Calendar, Apple Calendar, Outlook). */
export function downloadCalendar(trip: Trip) {
  const events = trip.days.flatMap((day) =>
    day.items.map((stop) => {
      const [h, m] = stop.time.split(":").map(Number);
      const endMinutes = h * 60 + m + Math.max(stop.duration_min, 30);
      const end = `${String(Math.min(Math.floor(endMinutes / 60), 23)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      return [
        "BEGIN:VEVENT",
        `UID:${stop.id}-${trip.id}@feelit`,
        `DTSTAMP:${stamp(day.date, "00:00")}`,
        `DTSTART;TZID=Asia/Kolkata:${stamp(day.date, stop.time)}`,
        `DTEND;TZID=Asia/Kolkata:${stamp(day.date, end)}`,
        `SUMMARY:${escape(stop.name)}`,
        `DESCRIPTION:${escape(stop.description)}`,
        `LOCATION:${escape(`${stop.name}, ${trip.destination.label}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    }),
  );
  const file = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Feel It//Trip//EN", `X-WR-CALNAME:${escape(trip.title)}`, ...events, "END:VCALENDAR"].join("\r\n");
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([file], { type: "text/calendar" })),
    download: `${trip.title.replace(/[^\w]+/g, "-")}.ics`,
  });
  link.click();
  URL.revokeObjectURL(link.href);
}
