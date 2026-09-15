import { array, integer, nonempty, record, requireValue, scalarCompare } from "../state-exposure/canonical.ts";
import type { InspectionRequest, Issue, Location, ReasonCode } from "./contract.ts";
import { REASON_CODES } from "./contract.ts";

export function compareLocations(a: Location | null, b: Location | null): number {
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  return scalarCompare(a.file, b.file) || a.byteStart - b.byteStart || a.byteEnd - b.byteEnd;
}

export function compareIssues(a: Issue, b: Issue): number {
  return (
    scalarCompare(a.code, b.code) ||
    scalarCompare(a.subject, b.subject) ||
    compareLocations(a.location, b.location) ||
    scalarCompare(a.message, b.message)
  );
}

/**
 * Resolution crosses modules and packages, so a location names any source of the
 * snapshot rather than only the file that declares the requested operation.
 */
export function sourceLocation(value: unknown, request: InspectionRequest, subject: string): Location {
  const item = record(value, subject);
  const file = nonempty(item.file, `${subject}.file`);
  const source = request.sources.find((entry) => entry.path === file);
  requireValue(source, `${subject}.file`, "Location file is not in the request.");
  const line = integer(item.line, `${subject}.line`, 1);
  const byteStart = integer(item.byteStart, `${subject}.byteStart`);
  const byteEnd = integer(item.byteEnd, `${subject}.byteEnd`);
  requireValue(byteStart < byteEnd && byteEnd <= source.byteLength, subject, "Invalid source byte range.");
  requireValue(
    line <= source.lineStarts.length &&
      byteStart >= source.lineStarts[line - 1] &&
      (line === source.lineStarts.length || byteStart < source.lineStarts[line]),
    subject,
    "Line does not contain byteStart.",
  );
  return { file, line, byteStart, byteEnd };
}

export function evidenceLocations(value: unknown, request: InspectionRequest, subject: string): Location[] {
  return array(value, subject, 1)
    .map((entry, index) => sourceLocation(entry, request, `${subject}.${index}`))
    .sort(compareLocations);
}

export function issues(value: unknown, request: InspectionRequest, subject: string, minimum = 1): Issue[] {
  return array(value, subject, minimum)
    .map((entry, index) => {
      const field = `${subject}.${index}`;
      const item = record(entry, field);
      requireValue(REASON_CODES.includes(item.code as ReasonCode), `${field}.code`, "Unknown reason code.");
      return {
        code: item.code as ReasonCode,
        message: nonempty(item.message, `${field}.message`),
        subject: nonempty(item.subject, `${field}.subject`),
        location: item.location === null ? null : sourceLocation(item.location, request, `${field}.location`),
      };
    })
    .sort(compareIssues);
}
