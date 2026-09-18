// EventKit bridge for script/robins-calendar.ts: JSON in, JSON out, nothing else.
//
//   ekcal list  "<calendar title>" <fromISO> <toISO>     events in the range, as a JSON array
//   ekcal apply "<calendar title>" < ops.json            create and update events, results as a JSON array
//   ekcal run   <program> [args...]                      ask for calendar access, then run the program
//
// "run" is how launchd starts the daily job. macOS pins a privacy request on the process launchd
// started, and only shows the prompt when that process carries a usage description (the Info.plist
// robins-calendar.ts links into this binary). Started as "bun script/robins-calendar.ts" the request is
// pinned on bun and refused without a prompt; started as "ekcal run bun script/..." it is pinned on
// ekcal, prompts once, and the list and apply calls further down inherit the grant. cron can never
// prompt: it runs outside the login session. A rebuild of this file changes the binary and macOS asks again.
//
// It talks to the local Calendar store (the iCloud account syncs it onward), so it needs the
// Calendars permission of whatever runs it (System Settings, Privacy & Security, Calendars).
// The daily sync never removes anything. The one "remove" op exists for the first load of a calendar
// that people filled by hand: it needs the event id, its exact start and its exact title, so it can
// only ever hit the event the caller has just read. span "future" ends a repeating series from that
// occurrence on (earlier occurrences stay as history).
// The calendar is found by exact title and must be unique among writable calendars.

import EventKit
import Foundation

func die(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

func parseDate(_ s: String) -> Date {
    guard let d = iso.date(from: s) else { die("ekcal: not an ISO 8601 date: \(s)") }
    return d
}

func emit(_ value: Any) {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

let store = EKEventStore()

func requestAccess() -> Bool {
    let semaphore = DispatchSemaphore(value: 0)
    var granted = false
    if #available(macOS 14.0, *) {
        store.requestFullAccessToEvents { g, _ in granted = g; semaphore.signal() }
    } else {
        store.requestAccess(to: .event) { g, _ in granted = g; semaphore.signal() }
    }
    semaphore.wait()
    return granted
}

func findCalendar(_ title: String) -> EKCalendar {
    let matches = store.calendars(for: .event).filter { $0.title == title && $0.allowsContentModifications }
    if matches.isEmpty { die("ekcal: no writable calendar titled \"\(title)\"") }
    if matches.count > 1 { die("ekcal: \(matches.count) writable calendars titled \"\(title)\"; rename one") }
    return matches[0]
}

func describe(_ e: EKEvent) -> [String: Any] {
    return [
        "id": e.eventIdentifier ?? "",
        "title": e.title ?? "",
        "start": iso.string(from: e.startDate),
        "end": iso.string(from: e.endDate),
        "notes": e.notes ?? "",
        "location": e.location ?? "",
        "url": e.url?.absoluteString ?? "",
        "all_day": e.isAllDay,
        "recurring": e.hasRecurrenceRules,
        "detached": e.isDetached,
    ]
}

func setFields(_ e: EKEvent, from op: [String: Any]) {
    if let v = op["title"] as? String { e.title = v }
    if let v = op["start"] as? String { e.startDate = parseDate(v) }
    if let v = op["end"] as? String { e.endDate = parseDate(v) }
    if let v = op["notes"] as? String { e.notes = v }
    if let v = op["location"] as? String { e.location = v }
    if let v = op["url"] as? String { e.url = URL(string: v) }
}

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2 else { die("usage: ekcal list <calendar> <fromISO> <toISO> | ekcal apply <calendar> < ops.json | ekcal run <program> [args...]") }
guard requestAccess() else { die("ekcal: calendar access denied (System Settings, Privacy & Security, Calendars)") }

if args[0] == "run" {
    let child = Process()
    child.executableURL = URL(fileURLWithPath: args[1])
    child.arguments = Array(args.dropFirst(2))
    do { try child.run() } catch { die("ekcal: cannot run \(args[1]): \(error.localizedDescription)") }
    child.waitUntilExit()
    exit(child.terminationStatus)
}

let cal = findCalendar(args[1])

switch args[0] {
case "list":
    guard args.count == 4 else { die("usage: ekcal list <calendar> <fromISO> <toISO>") }
    let predicate = store.predicateForEvents(withStart: parseDate(args[2]), end: parseDate(args[3]), calendars: [cal])
    emit(store.events(matching: predicate).sorted { $0.startDate < $1.startDate }.map(describe))

case "apply":
    let input = FileHandle.standardInput.readDataToEndOfFile()
    guard let ops = (try? JSONSerialization.jsonObject(with: input)) as? [[String: Any]] else { die("ekcal: stdin is not a JSON array of ops") }
    var results: [[String: Any]] = []
    var saved: [(index: Int, event: EKEvent)] = []
    for op in ops {
        let kind = op["op"] as? String ?? ""
        let key = op["key"] as? String ?? ""
        let event: EKEvent
        switch kind {
        case "create":
            event = EKEvent(eventStore: store)
            event.calendar = cal
        case "update":
            guard let id = op["id"] as? String, let found = store.event(withIdentifier: id), found.calendar.calendarIdentifier == cal.calendarIdentifier else {
                results.append(["key": key, "op": kind, "ok": false, "error": "event not found in this calendar"])
                continue
            }
            event = found
        case "remove":
            guard let id = op["id"] as? String, let startText = op["start"] as? String, let title = op["confirm_title"] as? String else {
                results.append(["key": key, "op": kind, "ok": false, "error": "remove needs id, start and confirm_title"])
                continue
            }
            let start = parseDate(startText)
            let around = store.predicateForEvents(withStart: start.addingTimeInterval(-60), end: start.addingTimeInterval(60), calendars: [cal])
            guard let target = store.events(matching: around).first(where: { $0.eventIdentifier == id && abs($0.startDate.timeIntervalSince(start)) < 1 && ($0.title ?? "") == title }) else {
                results.append(["key": key, "op": kind, "ok": false, "error": "no event with that id, start and title"])
                continue
            }
            do {
                try store.remove(target, span: (op["span"] as? String) == "future" ? .futureEvents : .thisEvent, commit: false)
                results.append(["key": key, "op": kind, "ok": true])
            } catch {
                results.append(["key": key, "op": kind, "ok": false, "error": error.localizedDescription])
            }
            continue
        default:
            results.append(["key": key, "op": kind, "ok": false, "error": "unknown op"])
            continue
        }
        setFields(event, from: op)
        do {
            try store.save(event, span: .thisEvent, commit: false)
            saved.append((results.count, event))
            results.append(["key": key, "op": kind, "ok": true])
        } catch {
            results.append(["key": key, "op": kind, "ok": false, "error": error.localizedDescription])
        }
    }
    do { try store.commit() } catch { die("ekcal: commit failed: \(error.localizedDescription)") }
    // Identifiers are final only after the commit.
    for (index, event) in saved { results[index].merge(describe(event)) { old, _ in old } }
    emit(results)

default:
    die("ekcal: unknown command \(args[0])")
}
