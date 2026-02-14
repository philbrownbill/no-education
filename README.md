# Still no Education for my son

A simple static website that displays a counter of school days without education, suitable for deployment on GitHub Pages.

## Configuration

Edit `script.js` to change the counter behaviour.

### Setting `baselineDate` and `initialCount`

```javascript
const config = {
  initialCount: 295,           // School days already elapsed before baselineDate
  baselineDate: "2026-02-13",  // First date included in the count (YYYY-MM-DD)
  pausedRanges: [],
  manualPause: null
};
```

- **`baselineDate`**: The first date that is counted. Use the date when you started tracking (or the last known count date).
- **`initialCount`**: The number of school days that had already passed before `baselineDate`. The displayed total is `initialCount` + weekdays since baseline (excluding paused periods).

### Adding `pausedRanges` (school holidays)

Add date ranges when school holidays occur so those weekdays are not counted:

```javascript
pausedRanges: [
  { start: "2026-02-16", end: "2026-02-20" },  // Half-term
  { start: "2026-04-06", end: "2026-04-17" }   // Easter holiday
]
```

- Use **YYYY-MM-DD** format.
- Both `start` and `end` are **inclusive**.
- Only weekdays (Mon–Fri) within these ranges are excluded from the count.

### Optional `manualPause`

To temporarily pause the counter (e.g. during a dispute resolution period):

```javascript
manualPause: { start: "2026-03-01", end: "2026-03-15" }
```

Set to `null` when not in use.

## Deploying to GitHub Pages

1. **Create a GitHub repository** and push this project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub.
   - Click **Settings** → **Pages** (under "Code and automation").
   - Under **Source**, select **Deploy from a branch**.
   - Choose branch **main** and folder **/ (root)**.
   - Click **Save**.

3. Your site will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO/` after a short delay.

## Local development

Open `index.html` in a browser, or use a simple local server:

```bash
npx serve .
```

Then visit `http://localhost:3000`.
