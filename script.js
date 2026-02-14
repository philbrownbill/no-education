/**
 * Test mode: parse URL params ?testDate=YYYY-MM-DD&testTime=HH:MM (Europe/London).
 * If only testDate: default time to 12:00. If only testTime: ignore (date required).
 */
function getTestInstant() {
  const params = new URLSearchParams(window.location.search);
  const testDate = params.get("testDate");
  const testTime = params.get("testTime");
  if (!testDate || !/^\d{4}-\d{2}-\d{2}$/.test(testDate)) return null;
  const timePart = testTime || "12:00";
  const [y, mo, d] = testDate.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  if (isNaN(y) || isNaN(mo) || isNaN(d)) return null;
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en", { timeZone: "Europe/London", hour: "numeric", hour12: false });
  const londonHour = parseInt(fmt.format(noonUTC), 10);
  const offsetHours = londonHour - 12;
  const utcH = (h - offsetHours + 24) % 24;
  const utcM = (min || 0);
  return new Date(Date.UTC(y, mo - 1, d, utcH, utcM, 0));
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
  initialCount: 294,
  get baselineDate() {
    return getUKTodayISO();
  },
  pausedRanges: [{ start: "2026-02-16", end: "2026-02-20" }],
  manualPause: null,
  /** If set to "YYYY-MM-DD HH:MM", used as UK time source for testing. */
  testNowUK: null
};

/**
 * Parses an ISO date string (YYYY-MM-DD) to a local-midnight Date.
 */
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * UK time helpers using Intl with timeZone: "Europe/London".
 * Europe/London handles BST (British Summer Time) automatically—no manual DST logic needed.
 * @param {Date} [date=new Date()] - The instant to resolve in UK time (use config.testNowUK for testing).
 */
function getUKParts(date = new Date()) {
  let instant = testInstant || date;
  if (config.testNowUK && !testInstant) {
    const [datePart, timePart] = config.testNowUK.split(" ");
    instant = new Date(`${datePart}T${timePart || "00:00"}:00`);
  }
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

function getUKTodayISO(date = new Date()) {
  const p = getUKParts(date);
  return `${String(p.year)}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Converts a Date to YYYY-MM-DD (for date arithmetic results).
 */
function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the effective end date for counting and whether today is counted.
 * Before 15:30 UK: today has not finished, effectiveEnd = UK yesterday.
 * At/after 15:30 UK: today is counted, effectiveEnd = UK today.
 */
function getEffectiveEndAndStatus() {
  const p = getUKParts();
  const ukTodayISO = `${String(p.year)}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const shouldCountToday = p.hour > 15 || (p.hour === 15 && p.minute >= 30);

  let effectiveEndISO;
  if (shouldCountToday) {
    effectiveEndISO = ukTodayISO;
  } else {
    const d = parseISODate(ukTodayISO);
    d.setDate(d.getDate() - 1);
    effectiveEndISO = dateToISO(d);
  }

  const timeStr = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const status = shouldCountToday
    ? `UK time now: ${timeStr} — Today counted.`
    : `UK time now: ${timeStr} — Next increment at 15:30 (UK).`;

  return { effectiveEndISO, status };
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
 * Returns true if the date is a weekday (Mon–Fri).
 */
function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
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
 * Counts weekdays from the day after baselineDate to endDate (inclusive).
 * baselineDate is the date when the count was exactly initialCount, so we start counting the next day.
 * Excludes any days that fall within paused ranges.
 */
function countWeekdaysSinceBaseline(baselineDateStr, endDateStr, pausedRanges) {
  const baseline = parseISODate(baselineDateStr);
  const end = parseISODate(endDateStr);
  if (end <= baseline) return 0;

  const ranges = [...pausedRanges];
  if (config.manualPause) ranges.push(config.manualPause);

  let count = 0;
  const current = new Date(baseline);
  current.setDate(current.getDate() + 1);
  current.setHours(0, 0, 0, 0);

  const endTime = end.getTime();

  while (current.getTime() <= endTime) {
    if (isWeekday(current) && !isInRanges(current, ranges)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Updates the counter display.
 */
function updateCounter() {
  const p = getUKParts();
  const { effectiveEndISO, status } = getEffectiveEndAndStatus();
  const shouldCountToday = p.hour > 15 || (p.hour === 15 && p.minute >= 30);
  const ranges = [...config.pausedRanges];
  if (config.manualPause) ranges.push(config.manualPause);
  const isPausedEffectiveDay = isInRanges(parseISODate(effectiveEndISO), ranges);

  const computedAddedWeekdays = countWeekdaysSinceBaseline(
    config.baselineDate,
    effectiveEndISO,
    config.pausedRanges
  );
  const total = config.initialCount + computedAddedWeekdays;

  const digitTiles = document.getElementById("digitTiles");
  const asOfEl = document.getElementById("as-of");
  const debugEl = document.getElementById("debug");

  if (digitTiles) {
    const digits = String(total).split("");
    digitTiles.innerHTML = digits
      .map((d) => `<span class="digit-tile">${d}</span>`)
      .join("");
  }
  document.querySelectorAll(".day-count").forEach((el) => {
    el.textContent = String(total);
  });
  const counterEl = document.querySelector(".counter[role='status']");
  if (counterEl) {
    counterEl.setAttribute("aria-label", `${total} school days without suitable education`);
  }
  if (asOfEl) asOfEl.textContent = `As of ${effectiveEndISO} (counts update after 15:30 UK time).`;
  const statusLineEl = document.getElementById("statusLine");
  if (statusLineEl) {
    const timeStr = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
    statusLineEl.textContent = `UK now: ${timeStr} | Today counted: ${shouldCountToday ? "yes" : "no"} | Effective end: ${effectiveEndISO} | Paused effective day: ${isPausedEffectiveDay ? "yes" : "no"}`;
  }
  const statusEl = document.getElementById("uk-status");
  if (statusEl) statusEl.textContent = status;
  if (debugEl) {
    const showDebug = new URLSearchParams(window.location.search).get("debug") === "1";
    debugEl.textContent = showDebug
      ? `Debug: baseline=${config.baselineDate}, initial=${config.initialCount}, added=${computedAddedWeekdays}, total=${total}, effectiveEnd=${effectiveEndISO}`
      : "";
    debugEl.style.display = showDebug ? "" : "none";
  }

  if (testInstant) {
    const p = getUKParts(testInstant);
    const display = `${String(p.year)}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
    let banner = document.getElementById("test-mode-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "test-mode-banner";
      banner.className = "test-mode-banner";
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.textContent = `TEST MODE — using UK time: ${display}`;
    banner.style.display = "";
  } else {
    const banner = document.getElementById("test-mode-banner");
    if (banner) banner.style.display = "none";
  }
}

// Run on load
updateCounter();
