import type { Journey, TripEvent } from "./journeyTypes.js";

const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

// RFC 5545 limits physical lines to 75 octets, not 75 JavaScript characters.
export function foldCalendarLine(line: string): string {
  let result = "", part = "", bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) { result += part + "\r\n"; part = " "; bytes = 1; }
    part += character; bytes += size;
  }
  return result + part;
}

export function calendarUid(journeyId: string, index: number): string {
  return `what-${journeyId}-${index}@what.local`;
}

export function calendarEvent(journey: Journey, event: TripEvent, index: number, reminderMinutes: number | null): string {
  const start = new Date(`${event.day}T${event.start}:00+08:00`);
  const end = new Date(`${event.day}T${event.end}:00+08:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error("行程时间无效，请重新生成行程");
  // Zero-duration departure/return markers become one-minute calendar entries.
  if (end.getTime() === start.getTime()) end.setMinutes(end.getMinutes() + 1);
  const description = [journey.title, event.note, `同行 ${journey.draft.people} 人`,
    event.leg ? `交通：${event.leg.km} 公里 / ${event.leg.minutes} 分钟` : "",
    ...journey.warnings, "由工具栈同步；时间按北京时间安排。"].filter(Boolean).join("\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//What Tool Stack//Outdoor//ZH-CN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${calendarUid(journey.id, index)}`, `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText([event.place.name, event.place.address].filter(Boolean).join(" · "))}`,
    `DESCRIPTION:${escapeText(description)}`, "STATUS:CONFIRMED", "TRANSP:OPAQUE"];
  if (reminderMinutes !== null) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${reminderMinutes}M`, `DESCRIPTION:${escapeText(event.title)}`, "END:VALARM");
  return [...lines, "END:VEVENT", "END:VCALENDAR"].map(foldCalendarLine).join("\r\n") + "\r\n";
}
