const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_TIMEZONE ||
  process.env.TIMEZONE ||
  'Asia/Dubai';

/**
 * Formats a date to "D MMM YYYY" (e.g. "4 Sep 2026")
 */
export function formatPatrolDate(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formats a time to "h:mm:ss A" (e.g. "8:32:53 AM") or "h:mm A"
 */
export function formatPatrolTime(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  includeSeconds = true,
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
      timeZone,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formats a full date-time to "D MMM YYYY, h:mm:ss A" (e.g. "4 Sep 2026, 8:32:53 AM")
 */
export function formatPatrolDateTime(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  includeSeconds = true,
): string {
  if (!dateInput) return '—';
  const dateStr = formatPatrolDate(dateInput, timeZone);
  const timeStr = formatPatrolTime(dateInput, timeZone, includeSeconds);
  if (dateStr === '—' || timeStr === '—') return '—';
  return `${dateStr}, ${timeStr}`;
}

/**
 * Calculates accurate patrol duration in seconds from authoritative timestamps.
 * Falls back to totalDuration if timestamps are unavailable.
 */
export function calculatePatrolDurationSeconds(
  startedAt?: string | Date | number | null,
  endedAt?: string | Date | null,
  totalDurationFallback?: number | null,
): number | null {
  if (startedAt && endedAt) {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(endedAt).getTime();
    if (!isNaN(startMs) && !isNaN(endMs)) {
      if (endMs < startMs) {
        return null; // Invalid reversed timestamps
      }
      return Math.max(0, Math.round((endMs - startMs) / 1000));
    }
  }

  if (
    typeof totalDurationFallback === 'number' &&
    !isNaN(totalDurationFallback) &&
    totalDurationFallback >= 0
  ) {
    return Math.round(totalDurationFallback);
  }

  return null;
}

/**
 * Formats seconds into human-readable duration:
 * - 0–59 seconds: "N sec" (e.g. "55 sec")
 * - 1–59 minutes: "N min N sec" (e.g. "2 min 5 sec")
 * - 1 hour or more: "N hr N min N sec" (e.g. "1 hr 0 min 0 sec", "1 hr 12 min 8 sec")
 */
export function formatSecondsToDuration(totalSec: number): string {
  if (isNaN(totalSec) || totalSec < 0) return '—';
  const sec = Math.round(totalSec);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSeconds = sec % 60;

  if (hours > 0) {
    return `${hours} hr ${minutes} min ${remainingSeconds} sec`;
  }
  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds} sec`;
  }
  return `${remainingSeconds} sec`;
}

/**
 * High-level helper taking a report / session object or timestamps and returning formatted duration string.
 */
export function formatPatrolDuration(
  reportOrStartedAt?: any,
  endedAt?: string | Date | null,
  totalDuration?: number | null,
): string {
  if (!reportOrStartedAt) return '—';

  let start: any = reportOrStartedAt;
  let end: any = endedAt;
  let fallback: any = totalDuration;
  let status: string | undefined = undefined;

  // Support passing the report object directly: formatPatrolDuration(report)
  if (typeof reportOrStartedAt === 'object' && !(reportOrStartedAt instanceof Date)) {
    start = reportOrStartedAt.startedAt;
    end = reportOrStartedAt.endedAt;
    fallback = reportOrStartedAt.totalDuration;
    status = reportOrStartedAt.status;
  }

  if (start && end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      return 'Invalid Duration';
    }
    if (endMs < startMs) {
      return 'Invalid Duration';
    }
    return formatSecondsToDuration(Math.max(0, Math.round((endMs - startMs) / 1000)));
  }

  // Handle in-progress patrols without endedAt
  if (status === 'IN_PROGRESS') {
    if (start) {
      const startMs = new Date(start).getTime();
      if (!isNaN(startMs)) {
        const nowMs = Date.now();
        if (nowMs >= startMs) {
          const ongoingSec = Math.round((nowMs - startMs) / 1000);
          return `${formatSecondsToDuration(ongoingSec)} (In Progress)`;
        }
      }
    }
    return 'In Progress';
  }

  const sec = calculatePatrolDurationSeconds(start, end, fallback);
  if (sec === null) return '—';
  return formatSecondsToDuration(sec);
}

export interface CheckpointTimingResult {
  startTimeFormatted: string;
  endTimeFormatted: string;
  durationFormatted: string;
  rawDurationSeconds: number | null;
  isCompleted: boolean;
  isPending: boolean;
  isIncomplete: boolean;
  isHistoricalUnrecorded: boolean;
}

/**
 * Resolves authoritative Start Time, End Time, and Duration for a patrol checkpoint across all scenarios:
 * - Scenario A: Completed with subtasks (End Time = submission / completedAt, Duration = End - Start)
 * - Scenario B: Checkpoint without subtasks (Instantaneous completion duration = 0 sec, End Time = Start Time or completedAt)
 * - Scenario C: Scanned but incomplete (Start Time = scan time, End Time = "Not completed", Duration = "Incomplete")
 * - Scenario D: Unscanned checkpoint (Start = "—", End = "—", Duration = "—")
 * - Scenario E: Multiple scan attempts handled at the checkpoint entry level
 * - Scenario F: Offline submission preserves recorded activity timestamps
 * - Section 9: Historical records missing explicit completion timestamps display End Time = "Not recorded", Duration = "Not available"
 */
export function resolveCheckpointTiming(
  checkpoint: {
    scanned?: boolean;
    scannedAt?: string | Date | null;
    completedAt?: string | Date | null;
    status?: string | null;
    tasks?: Array<{
      id?: string;
      gateSubTaskId?: string;
      sourceMasterItemId?: string;
      answer?: string;
      isRequired?: boolean;
      answeredAt?: string | Date | null;
      role?: string;
    }>;
    subTaskResponses?: Array<{
      id?: string;
      gateSubTaskId?: string;
      answer?: string;
      answeredAt?: string | Date | null;
      role?: string;
      gateSubTask?: { id?: string; role?: string };
    }>;
  },
  timeZone: string = DEFAULT_TIMEZONE,
): CheckpointTimingResult {
  const isScanned = !!checkpoint.scanned || !!checkpoint.scannedAt;

  // Scenario D — Unscanned checkpoint
  if (!isScanned || !checkpoint.scannedAt) {
    return {
      startTimeFormatted: '—',
      endTimeFormatted: '—',
      durationFormatted: '—',
      rawDurationSeconds: null,
      isCompleted: false,
      isPending: true,
      isIncomplete: false,
      isHistoricalUnrecorded: false,
    };
  }

  const startMs = new Date(checkpoint.scannedAt).getTime();
  if (isNaN(startMs)) {
    return {
      startTimeFormatted: '—',
      endTimeFormatted: '—',
      durationFormatted: '—',
      rawDurationSeconds: null,
      isCompleted: false,
      isPending: false,
      isIncomplete: true,
      isHistoricalUnrecorded: false,
    };
  }

  const startTimeFormatted = formatPatrolTime(checkpoint.scannedAt, timeZone);

  // Check subtask states
  const tasks = checkpoint.tasks || [];
  const responses = checkpoint.subTaskResponses || [];
  const hasConfiguredTasks = tasks.length > 0;
  const hasResponses =
    responses.length > 0 ||
    tasks.some((t) => t.answer && t.answer !== 'UNANSWERED');

  // Build lookup map for responses if responses array is present
  const responseMap = new Map<string, any>();
  for (const res of responses) {
    const key =
      (res as any).gateSubTaskId ||
      (res as any).id ||
      (res as any).gateSubTask?.id;
    if (key) {
      responseMap.set(key, res);
    }
  }

  // Scenario C — Scanned but incomplete checkpoint
  // If there are configured required tasks and any is unanswered, inspection is incomplete
  const hasUnansweredRequiredTasks =
    hasConfiguredTasks &&
    tasks.some((t: any) => {
      if (!t.isRequired) return false;
      // 1. Direct answer on task object
      if (t.answer && t.answer !== 'UNANSWERED') return false;
      // 2. Correlate with submitted responses if available
      const key = t.id || t.gateSubTaskId || t.sourceMasterItemId;
      const matchedRes = key ? responseMap.get(key) : undefined;
      if (
        matchedRes &&
        matchedRes.answer &&
        matchedRes.answer !== 'UNANSWERED'
      ) {
        return false;
      }
      return true;
    });

  if (hasUnansweredRequiredTasks) {
    return {
      startTimeFormatted,
      endTimeFormatted: 'Not completed',
      durationFormatted: 'Incomplete',
      rawDurationSeconds: null,
      isCompleted: false,
      isPending: false,
      isIncomplete: true,
      isHistoricalUnrecorded: false,
    };
  }

  // Check completion timestamp
  let endMs: number | null = null;
  let endSource: string | Date | null = null;

  if (checkpoint.completedAt) {
    const compMs = new Date(checkpoint.completedAt).getTime();
    if (!isNaN(compMs)) {
      endMs = compMs;
      endSource = checkpoint.completedAt;
    }
  }

  // If completedAt wasn't explicitly set, check if subtasks have a distinct completion timestamp
  if (endMs === null && hasResponses) {
    const allTaskTimes = [
      ...tasks.map(t => t.answeredAt),
      ...responses.map(r => r.answeredAt),
    ]
      .filter(Boolean)
      .map(t => new Date(t!).getTime())
      .filter(ms => !isNaN(ms));

    if (allTaskTimes.length > 0) {
      const maxTaskMs = Math.max(...allTaskTimes);
      // If the subtask completion time is strictly greater than startMs (by at least 1s)
      if (maxTaskMs - startMs >= 1000) {
        endMs = maxTaskMs;
        endSource = new Date(maxTaskMs);
      }
    }
  }

  // Scenario B — Checkpoint without subtasks
  if (!hasConfiguredTasks && responses.length === 0) {
    if (endMs !== null) {
      const durSec = Math.max(0, Math.round((endMs - startMs) / 1000));
      return {
        startTimeFormatted,
        endTimeFormatted: formatPatrolTime(endSource, timeZone),
        durationFormatted: formatSecondsToDuration(durSec),
        rawDurationSeconds: durSec,
        isCompleted: true,
        isPending: false,
        isIncomplete: false,
        isHistoricalUnrecorded: false,
      };
    }
    // Instantaneous completion upon QR scan
    return {
      startTimeFormatted,
      endTimeFormatted: startTimeFormatted,
      durationFormatted: '0 sec',
      rawDurationSeconds: 0,
      isCompleted: true,
      isPending: false,
      isIncomplete: false,
      isHistoricalUnrecorded: false,
    };
  }

  // Scenario A & Historical — Checkpoint with subtasks
  if (endMs !== null) {
    const durSec = Math.max(0, Math.round((endMs - startMs) / 1000));
    return {
      startTimeFormatted,
      endTimeFormatted: formatPatrolTime(endSource, timeZone),
      durationFormatted: formatSecondsToDuration(durSec),
      rawDurationSeconds: durSec,
      isCompleted: true,
      isPending: false,
      isIncomplete: false,
      isHistoricalUnrecorded: false,
    };
  }

  // Section 9: Historical patrol compatibility
  // Subtasks exist, but no distinct completion timestamp was recorded
  return {
    startTimeFormatted,
    endTimeFormatted: 'Not recorded',
    durationFormatted: 'Not available',
    rawDurationSeconds: null,
    isCompleted: true,
    isPending: false,
    isIncomplete: false,
    isHistoricalUnrecorded: true,
  };
}

/**
 * Calculates the exact overlap duration in seconds between an activity interval [start, end]
 * and a reporting window [windowStart, windowEnd].
 * Clips out-of-boundary time to prevent double-counting across adjacent days/periods.
 */
export function calculateOverlapDurationSeconds(
  start: Date | string | number | null | undefined,
  end: Date | string | number | null | undefined,
  windowStart: Date | string | number,
  windowEnd: Date | string | number,
): number | null {
  if (!start || !end) return null;
  const sMs = new Date(start).getTime();
  const eMs = new Date(end).getTime();
  if (isNaN(sMs) || isNaN(eMs) || eMs < sMs) return null;

  const wStartMs = new Date(windowStart).getTime();
  const wEndMs = new Date(windowEnd).getTime();
  if (isNaN(wStartMs) || isNaN(wEndMs)) return null;

  const clippedStart = Math.max(sMs, wStartMs);
  const clippedEnd = Math.min(eMs, wEndMs);

  if (clippedEnd <= clippedStart) return 0;
  return Math.round((clippedEnd - clippedStart) / 1000);
}

/**
 * Formats duration in seconds into a concise human-readable string:
 * e.g. "18 hr 42 min", "2 min 35 sec", "55 sec", "0 sec".
 */
export function formatDurationHuman(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '0 sec';
  const sec = Math.round(seconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return remSec > 0 ? `${hours} hr ${minutes} min ${remSec} sec` : `${hours} hr ${minutes} min`;
    }
    return remSec > 0 ? `${hours} hr ${remSec} sec` : `${hours} hr`;
  }
  if (minutes > 0) {
    return remSec > 0 ? `${minutes} min ${remSec} sec` : `${minutes} min`;
  }
  return `${remSec} sec`;
}

/**
 * Returns YYYY-MM-DD date string representation in the specified IANA timezone.
 */
export function getDateStringInTimezone(
  date: Date | string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Returns the date components (year, month 1-12, day, hours, minutes, seconds)
 * of a given Date in the target IANA timezone.
 */
export function getDateComponentsInTimezone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }
  if (partMap.hour === 24) partMap.hour = 0;
  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hours: partMap.hour,
    minutes: partMap.minute,
    seconds: partMap.second || 0,
  };
}

/**
 * Constructs a Date (UTC timestamp) representing the exact wall-clock date and time
 * in the specified IANA timezone.
 */
export function createDateInTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const utcCandidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcCandidate);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }
  if (partMap.hour === 24) partMap.hour = 0;

  const tzTimeAsUtc = Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    partMap.hour,
    partMap.minute,
    partMap.second || 0,
  );

  const offsetMs = tzTimeAsUtc - utcCandidate.getTime();
  return new Date(utcCandidate.getTime() - offsetMs);
}

export interface ReportingPeriodResult {
  from: Date; // Start of interval (inclusive) in UTC
  to: Date; // End of interval (exclusive) in UTC
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string; // YYYY-MM-DD
  periodLabel: string;
}

/**
 * Authoritative reporting-period resolver for all 4 report types:
 * - DAILY: Selected business date, from local midnight to following local midnight.
 * - WEEKLY: Selected Monday through Sunday, with exclusive end boundary at following Monday midnight.
 * - MONTHLY: First day of selected month through first day of following month, exclusive.
 * - CUSTOM: Selected From Date through To Date inclusive in UI, converted to half-open interval ending at midnight following To Date.
 *
 * Uses the business timezone (e.g. Asia/Dubai) to avoid server-local timezone skew.
 */
export function getReportingPeriodBoundaries(
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' | string,
  params: {
    date?: string;
    month?: string;
    week?: string;
    startDate?: string;
    endDate?: string;
    fromDate?: string;
    toDate?: string;
  },
  timeZone: string = DEFAULT_TIMEZONE,
): ReportingPeriodResult {
  const pType = (periodType || 'DAILY').toUpperCase();

  const parseDateParts = (dateStr?: string) => {
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { year: parts[0], month: parts[1], day: parts[2] || 1 };
      }
    }
    return null;
  };

  const getTodayParts = () => {
    const comp = getDateComponentsInTimezone(new Date(), timeZone);
    return { year: comp.year, month: comp.month, day: comp.day };
  };

  if (pType === 'CUSTOM' || (params.startDate && params.endDate) || (params.fromDate && params.toDate)) {
    const startStr = params.startDate || params.fromDate;
    const endStr = params.endDate || params.toDate;
    if (!startStr || !endStr) {
      throw new Error('Both From Date and To Date are required for Custom Range reports.');
    }
    const pStart = parseDateParts(startStr);
    const pEnd = parseDateParts(endStr);
    if (!pStart || !pEnd) {
      throw new Error('Invalid date format provided for Custom Range report.');
    }

    const from = createDateInTimezone(pStart.year, pStart.month, pStart.day, 0, 0, 0, timeZone);
    const nextEndUtc = new Date(Date.UTC(pEnd.year, pEnd.month - 1, pEnd.day + 1, 12, 0, 0));
    const to = createDateInTimezone(
      nextEndUtc.getUTCFullYear(),
      nextEndUtc.getUTCMonth() + 1,
      nextEndUtc.getUTCDate(),
      0,
      0,
      0,
      timeZone,
    );

    if (to.getTime() <= from.getTime()) {
      throw new Error('To Date cannot be earlier than From Date.');
    }

    const startDateStr = `${pStart.year}-${String(pStart.month).padStart(2, '0')}-${String(pStart.day).padStart(2, '0')}`;
    const endDateStr = `${pEnd.year}-${String(pEnd.month).padStart(2, '0')}-${String(pEnd.day).padStart(2, '0')}`;
    const formatCustomLabel = (d: Date) =>
      new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: '2-digit', timeZone }).format(d);
    const periodLabel = `${formatCustomLabel(from)} to ${formatCustomLabel(new Date(to.getTime() - 1000))}`;

    return { from, to, startDateStr, endDateStr, periodLabel };
  }

  if (pType === 'DAILY') {
    const p = parseDateParts(params.date) || getTodayParts();
    const from = createDateInTimezone(p.year, p.month, p.day, 0, 0, 0, timeZone);
    const nextDayUtc = new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 12, 0, 0));
    const to = createDateInTimezone(
      nextDayUtc.getUTCFullYear(),
      nextDayUtc.getUTCMonth() + 1,
      nextDayUtc.getUTCDate(),
      0,
      0,
      0,
      timeZone,
    );

    const startDateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    const endDateStr = startDateStr;
    const periodLabel = formatPatrolDate(from, timeZone);

    return { from, to, startDateStr, endDateStr, periodLabel };
  }

  if (pType === 'WEEKLY') {
    let pStart: { year: number; month: number; day: number };
    let pEnd: { year: number; month: number; day: number };

    if (params.startDate && params.endDate) {
      const s = parseDateParts(params.startDate);
      const e = parseDateParts(params.endDate);
      if (s && e) {
        pStart = s;
        pEnd = e;
      } else {
        const p = parseDateParts(params.date) || getTodayParts();
        const refUtc = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
        const dayOfWeek = refUtc.getUTCDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const monUtc = new Date(Date.UTC(p.year, p.month - 1, p.day + diffToMonday, 12, 0, 0));
        const sunUtc = new Date(Date.UTC(monUtc.getUTCFullYear(), monUtc.getUTCMonth(), monUtc.getUTCDate() + 6, 12, 0, 0));
        pStart = { year: monUtc.getUTCFullYear(), month: monUtc.getUTCMonth() + 1, day: monUtc.getUTCDate() };
        pEnd = { year: sunUtc.getUTCFullYear(), month: sunUtc.getUTCMonth() + 1, day: sunUtc.getUTCDate() };
      }
    } else {
      const p = parseDateParts(params.date) || getTodayParts();
      const refUtc = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
      const dayOfWeek = refUtc.getUTCDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monUtc = new Date(Date.UTC(p.year, p.month - 1, p.day + diffToMonday, 12, 0, 0));
      const sunUtc = new Date(Date.UTC(monUtc.getUTCFullYear(), monUtc.getUTCMonth(), monUtc.getUTCDate() + 6, 12, 0, 0));
      pStart = { year: monUtc.getUTCFullYear(), month: monUtc.getUTCMonth() + 1, day: monUtc.getUTCDate() };
      pEnd = { year: sunUtc.getUTCFullYear(), month: sunUtc.getUTCMonth() + 1, day: sunUtc.getUTCDate() };
    }

    const from = createDateInTimezone(pStart.year, pStart.month, pStart.day, 0, 0, 0, timeZone);
    const nextMonUtc = new Date(Date.UTC(pEnd.year, pEnd.month - 1, pEnd.day + 1, 12, 0, 0));
    const to = createDateInTimezone(
      nextMonUtc.getUTCFullYear(),
      nextMonUtc.getUTCMonth() + 1,
      nextMonUtc.getUTCDate(),
      0,
      0,
      0,
      timeZone,
    );

    const startDateStr = `${pStart.year}-${String(pStart.month).padStart(2, '0')}-${String(pStart.day).padStart(2, '0')}`;
    const endDateStr = `${pEnd.year}-${String(pEnd.month).padStart(2, '0')}-${String(pEnd.day).padStart(2, '0')}`;
    const periodLabel = `Week of ${formatPatrolDate(from, timeZone)} – ${formatPatrolDate(new Date(to.getTime() - 1000), timeZone)}`;

    return { from, to, startDateStr, endDateStr, periodLabel };
  }

  // MONTHLY
  const p = parseDateParts(params.month) || parseDateParts(params.date) || getTodayParts();
  const year = p.year;
  const month = p.month;
  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const from = createDateInTimezone(year, month, 1, 0, 0, 0, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = createDateInTimezone(nextYear, nextMonth, 1, 0, 0, 0, timeZone);

  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return { from, to, startDateStr, endDateStr, periodLabel };
}



