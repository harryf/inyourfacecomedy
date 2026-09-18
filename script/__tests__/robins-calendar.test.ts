import { describe, expect, test } from "bun:test";
import { keyOf, notesFor, planUpdate, roomFor, ticketsLine, titleFor, withTicketsLine } from "../robins-calendar";

const desired = { title: "🎤 Comedy Brew [Back]", start: "2026-09-24T19:30:00+02:00", end: "2026-09-24T22:00:00+02:00", notes: "Hosted by: A\nTickets: 24", location: "ROBIN's" };
const cal = (over: any = {}) => ({ id: "x", url: "", all_day: false, ...desired, start: "2026-09-24T17:30:00Z", end: "2026-09-24T20:00:00Z", ...over });

describe("robins-calendar", () => {
  test("room: Back by default, Front in July and August, front matter wins", () => {
    expect(roomFor("2026-09-24T19:30:00+02:00")).toBe("back");
    expect(roomFor("2026-07-30T19:30:00+02:00")).toBe("front");
    expect(roomFor("2026-08-31T23:30:00+02:00")).toBe("front");
    expect(roomFor("2026-07-30T19:30:00+02:00", "back")).toBe("back");
    expect(roomFor("2026-12-03T19:30:00+01:00", "Front")).toBe("front");
  });
  test("title: microphone, show name, room tag", () => {
    expect(titleFor("The NERDY COMEDY Show", "back")).toBe("🎤 The NERDY COMEDY Show [Back]");
    expect(titleFor("Comedy Brew", "front")).toBe("🎤 Comedy Brew [Front]");
  });
  test("key is the show page plus the Zurich date, winter offset quirk included", () => {
    expect(keyOf({ url: "/comedybrew/", start: "2026-11-05T20:30:00+02:00" })).toBe("https://inyourfacecomedy.ch/comedybrew/#2026-11-05");
  });
  test("notes: the host line and the ticket count, no room, nothing else", () => {
    expect(notesFor("Starring", ["F"], null)).toBe("Starring: F");
    expect(notesFor("Hosted by", ["A", "B"], "Tickets: 12")).toBe("Hosted by: A, B\nTickets: 12");
    expect(notesFor("Hosted by", [], null)).toBe("");
    expect(ticketsLine(12)).toBe("Tickets: 12");
    expect(ticketsLine(0)).toBe("Tickets: 0");
    expect(ticketsLine(null)).toBeNull();
  });
  test("untouched event: only changed fields are written, same instant in another zone is no change", () => {
    const written = { ...desired, notes: "Hosted by: A" };
    const { set, human } = planUpdate(cal({ notes: written.notes }), written, desired, "Tickets: 24");
    expect(human).toEqual([]);
    expect(Object.keys(set)).toEqual(["notes"]);
  });
  test("human-edited title and notes are never overwritten; only the Tickets line moves", () => {
    const written = { ...desired, notes: "Hosted by: A\nTickets: 20" };
    const current = cal({ title: "🎤 Comedy Brew [Front]", notes: "Open early please\nTickets: 20\nAsk Jun about chairs" });
    const { set, human } = planUpdate(current, written, desired, "Tickets: 24");
    expect(human).toEqual(["title", "notes"]);
    expect(set.title).toBeUndefined();
    expect(set.notes).toBe("Open early please\nTickets: 24\nAsk Jun about chairs");
  });
  test("edited notes without a Tickets line get one appended; no count means no write", () => {
    expect(withTicketsLine("Details coming", "Tickets: 3")).toBe("Details coming\nTickets: 3");
    expect(planUpdate(cal({ notes: "Details coming" }), desired, desired, null).set).toEqual({});
  });
  test("lost state: a field that differs from what we would write counts as human", () => {
    expect(planUpdate(cal({ location: "Front door" }), undefined, desired, null)).toEqual({ set: {}, human: ["location"] });
  });
  test("--force passes the current event as the record, so everything goes back to the website", () => {
    const current = cal({ title: "[Front] Comedy Brew", notes: "Harry: a note" });
    const { set, human } = planUpdate(current, current, desired, null);
    expect(human).toEqual([]);
    expect(set).toEqual({ title: desired.title, notes: desired.notes });
  });
});
