/**
 * Creates a Date representing the given UK date/time in Europe/London.
 */
function createUKInstant(dateStr, timeStr = "12:00") {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, min] = (timeStr || "12:00").split(":").map(Number);
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en", { timeZone: "Europe/London", hour: "numeric", hour12: false });
  const londonHour = parseInt(fmt.format(noonUTC), 10);
  const offsetHours = londonHour - 12;
  const utcH = (h - offsetHours + 24) % 24;
  const utcM = (min || 0);
  return new Date(Date.UTC(y, mo - 1, d, utcH, utcM, 0));
}

/**
 * Test mode: parse URL params ?testDate=YYYY-MM-DD&testTime=HH:MM (Europe/London).
 * If only testDate: default time to 12:00. If only testTime: ignore (date required).
 */
function getTestInstant() {
  const params = new URLSearchParams(window.location.search);
  const testDate = params.get("testDate");
  const testTime = params.get("testTime");
  if (!testDate || !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return null;
  const [y, mo, d] = testDate.split("-").map(Number);
  if (isNaN(y) || isNaN(mo) || isNaN(d)) return null;
  return createUKInstant(testDate, testTime || "12:00");
}

const testInstant = getTestInstant();

/**
 * Configuration for the school days counter.
 * The baselineDate represents the date when the count was exactly initialCount.
 * - baselineDate: Date when the count was exactly initialCount (YYYY-MM-DD).
 * - initialCount: School days as of baselineDate.
 * - pausedRanges: Array of { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } for school holidays (inclusive).
 * - manualPause: Optional { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } for manual pause (inclusive), or null.
 */
const config = {
  initialCount: 295,
  baselineDate: "2026-02-13",
  pausedRanges: [{ start: "2026-02-16", end: "2026-02-20" }],
  manualPause: null,
  /** If set to "YYYY-MM-DD HH:MM", used as UK time source for testing. */
  testNowUK: null
};

/**
 * Parses an ISO date string (YYYY-MM-DD) to a Date at noon UTC.
 * Noon UTC ensures the same calendar day in Europe/London (GMT or BST).
 */
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * UK time helpers using Intl with timeZone: "Europe/London".
 * Europe/London handles BST (British Summer Time) automatically—no manual DST logic needed.
 * @param {Date} [date=new Date()] - The instant to resolve in UK time (use config.testNowUK for testing).
 */
function getUKParts(overrideInstant = null) {
  let instant = overrideInstant || testInstant;
  if (!instant && config.testNowUK) {
    const [datePart, timePart] = config.testNowUK.split(" ");
    instant = new Date(`${datePart}T${timePart || "00:00"}:00`);
  }
  if (!instant) instant = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(instant);
  const obj = {};
  for (const p of parts) obj[p.type] = p.value;
  return {
    year: parseInt(obj.year, 10),
    month: parseInt(obj.month, 10),
    day: parseInt(obj.day, 10),
    hour: parseInt(obj.hour, 10),
    minute: parseInt(obj.minute, 10)
  };
}

function getUKTodayISO(overrideInstant = null) {
  const p = getUKParts(overrideInstant);
  return `${String(p.year)}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Converts a Date to YYYY-MM-DD using UTC (for UK date arithmetic).
 */
function dateToISO(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Returns the effective end date for counting.
 * Before 15:30 UK: today has not finished, effectiveEnd = UK yesterday.
 * At/after 15:30 UK: today is counted, effectiveEnd = UK today.
 * @param {Date} [overrideInstant] - Override instant (for testDate/testTime); uses testInstant or now if omitted.
 */
function getEffectiveEndAndStatus(overrideInstant = null) {
  const p = getUKParts(overrideInstant);
  const ukTodayISO = `${String(p.year)}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const shouldCountToday = p.hour > 15 || (p.hour === 15 && p.minute >= 30);

  let effectiveEndISO;
  if (shouldCountToday) {
    effectiveEndISO = ukTodayISO;
  } else {
    const d = parseISODate(ukTodayISO);
    d.setUTCDate(d.getUTCDate() - 1);
    effectiveEndISO = dateToISO(d);
  }

  return { effectiveEndISO };
}

/**
 * Formats a Date as YYYY-MM-DD in local time.
 */
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true if the date is a weekday (Mon–Fri) in Europe/London.
 */
function isWeekday(date) {
  const wd = new Intl.DateTimeFormat("en", { timeZone: "Europe/London", weekday: "short" }).format(date);
  return wd !== "Sat" && wd !== "Sun";
}

/**
 * Returns true if the date falls within any of the given ranges (inclusive).
 */
function isInRanges(date, ranges) {
  if (!ranges || ranges.length === 0) return false;
  const time = date.getTime();
  for (const range of ranges) {
    const start = parseISODate(range.start).getTime();
    const end = parseISODate(range.end).getTime();
    if (time >= start && time <= end) return true;
  }
  return false;
}

/**
 * Counts weekdays from the day after baseline to effectiveEndDate (inclusive).
 * baseline is the date when the count was exactly initialCount.
 * Excludes any days that fall within paused ranges.
 * @param {string} baselineISO - Baseline date (YYYY-MM-DD).
 * @param {Date} effectiveEndDate - Effective end date (Date object from effectiveEndISO).
 */
function countEffectiveWeekdays(baselineISO, effectiveEndDate, pausedRanges) {
  const baseline = parseISODate(baselineISO);
  if (effectiveEndDate <= baseline) return 0;

  const ranges = [...pausedRanges];
  if (config.manualPause) ranges.push(config.manualPause);

  let count = 0;
  const current = new Date(baseline);
  current.setUTCDate(current.getUTCDate() + 1);
  current.setUTCHours(12, 0, 0, 0);

  const endTime = effectiveEndDate.getTime();

  while (current.getTime() <= endTime) {
    if (isWeekday(current) && !isInRanges(current, ranges)) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Updates the counter display.
 */
function updateCounter() {
  const { effectiveEndISO } = getEffectiveEndAndStatus();
  const effectiveEndDate = parseISODate(effectiveEndISO);
  const baseline = config.baselineDate;
  const added = countEffectiveWeekdays(baseline, effectiveEndDate, config.pausedRanges);
  const total = config.initialCount + added;

  const digitTiles = document.getElementById("digitTiles");
  const asOfEl = document.getElementById("as-of");

  if (digitTiles) {
    digitTiles.innerHTML = String(total).split("").map((d) => `<span class="digit-tile">${d}</span>`).join("");
  }
  document.querySelectorAll(".day-count, .count-inline").forEach((el) => {
    el.textContent = String(total);
  });
  const counterEl = document.querySelector(".counter[role='status']");
  if (counterEl) {
    counterEl.setAttribute("aria-label", `${total} school days without suitable education`);
  }
  if (asOfEl) asOfEl.textContent = `As of ${effectiveEndISO} — ${total} school days (counts update after 15:30 UK time).`;
}

// Run on load
updateCounter();
