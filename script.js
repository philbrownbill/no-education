// script.js

// -------------------- CONFIG --------------------
const config = {
  // Set these so that: on baselineDate AFTER 15:30 UK time, the displayed count == initialCount
  initialCount: 295,
  baselineDate: "2026-02-13",

  // Inclusive paused date ranges (YYYY-MM-DD). Weekdays in these ranges are excluded.
  pausedRanges: [
    // Example:
    // { start: "2026-02-16", end: "2026-02-20" },
    { start: "2026-02-16", end: "2026-02-20" },
  ],

  // Optional inclusive manual pause range (or null)
  manualPause: null
  // manualPause: { start: "2026-07-20", end: "2026-08-31" }
};

// -------------------- DATE HELPERS --------------------
function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0); // local midnight
}

function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekday(date) {
  const day = date.getDay(); // 0 Sun ... 6 Sat
  return day !== 0 && day !== 6;
}

function isWithinRange(date, range) {
  const t = date.getTime();
  return (
    t >= parseISODate(range.start).getTime() &&
    t <= parseISODate(range.end).getTime()
  );
}

function isPaused(date) {
  if (config.manualPause && isWithinRange(date, config.manualPause)) return true;
  return config.pausedRanges.some((r) => isWithinRange(date, r));
}

// Count eligible weekdays strictly AFTER baseline, up to and including endDate.
function countEffectiveWeekdays(baselineDate, endDate) {
  if (endDate < baselineDate) return 0;

  let count = 0;

  // Start counting from the day AFTER baselineDate
  const d = new Date(baselineDate.getTime());
  d.setDate(d.getDate() + 1);

  for (; d <= endDate; d.setDate(d.getDate() + 1)) {
    if (!isWeekday(d)) continue;
    if (isPaused(d)) continue;
    count += 1;
  }

  return count;
}

// -------------------- UK TIME HELPERS --------------------
function pad2(n) {
  return String(n).padStart(2, "0");
}

function getUKParts(now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = dtf.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function ukISOFromParts(p) {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function shouldCountTodayUK(p) {
  return p.hour > 15 || (p.hour === 15 && p.minute >= 30);
}

// -------------------- TEST MODE (URL OVERRIDE) --------------------
function getTestUKPartsFromURL() {
  const params = new URLSearchParams(window.location.search);
  const testDate = params.get("testDate"); // YYYY-MM-DD
  if (!testDate) return null;

  const testTime = params.get("testTime") || "12:00"; // HH:MM
  const m = testTime.match(/^(\d{2}):(\d{2})$/);
  const tHour = m ? Number(m[1]) : 12;
  const tMinute = m ? Number(m[2]) : 0;

  // We treat these as already UK-local parts.
  const [y, mo, d] = testDate.split("-").map(Number);
  if (!y || !mo || !d) return null;

  return {
    year: y,
    month: mo,
    day: d,
    hour: tHour,
    minute: tMinute
  };
}

// -------------------- RENDER --------------------
function renderDigitTiles(total) {
  const digitTiles = document.getElementById("digitTiles");
  if (!digitTiles) return;

  const digits = String(total).split("");
  digitTiles.innerHTML = digits
    .map((d) => `<span class="digit-tile">${d}</span>`)
    .join("");
}

function updateAllInlineCounts(total) {
  document.querySelectorAll(".day-count").forEach((el) => {
    el.textContent = String(total);
  });
}

function updateAriaLabel(total) {
  const counter = document.querySelector(".counter");
  if (!counter) return;
  counter.setAttribute(
    "aria-label",
    `${total} school days without suitable education`
  );
}

function updateAsOfDate(effectiveEndISO) {
  // If your HTML has: As of <span id="asOfDate">...</span>
  const asOfDateEl = document.getElementById("asOfDate");
  if (asOfDateEl) {
    asOfDateEl.textContent = effectiveEndISO;
    return;
  }

  // Fallback: if you only have <p id="as-of">...</p> with no span
  const asOfEl = document.getElementById("as-of");
  if (asOfEl) {
    asOfEl.textContent = `As of ${effectiveEndISO}`;
  }
}

function getEffectiveEndISO() {
  // Use URL override if provided
  const testParts = getTestUKPartsFromURL();
  const ukParts = testParts || getUKParts(new Date());

  const ukTodayISO = ukISOFromParts(ukParts);
  const countToday = shouldCountTodayUK(ukParts);

  let effectiveEndISO = ukTodayISO;

  if (!countToday) {
    // before 15:30 UK time, effective end is UK yesterday
    const d = parseISODate(ukTodayISO);
    d.setDate(d.getDate() - 1);
    effectiveEndISO = dateToISO(d);
  }

  return effectiveEndISO;
}

function updateCounter() {
  const baseline = parseISODate(config.baselineDate);

  const effectiveEndISO = getEffectiveEndISO();
  const effectiveEndDate = parseISODate(effectiveEndISO);

  const added = countEffectiveWeekdays(baseline, effectiveEndDate);
  const total = config.initialCount + added;

  renderDigitTiles(total);
  updateAllInlineCounts(total);
  updateAriaLabel(total);
  updateAsOfDate(effectiveEndISO);
}

updateCounter();