# prompt-diff

> **Production-grade, git-style review tool for LLM prompts.**

When updating an LLM prompt, engineers review the change just like a Git diff. `prompt-diff` allows anyone on your team to inspect what changed between prompt versions and verifies template variables (`${variable_name}`) to guarantee downstream pipelines never break.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FINDIAN-MEET%2Fprompt-review)

---

## ✨ Features

- **Inline Git-Style Diff**:
  - Unified view with removals in red (`−`) and additions in green (`+`).
  - Two gutters for previous and current line numbers.
  - Intra-line **word-level highlighting** using `diffWordsWithSpace`.
  - Missing final newlines are normalized to avoid spurious end-of-file diffs.
  - "Changes only" toggle with a 2-line context window and collapsed indicator (`⋯`).

- **Variable Integrity Check**:
  - Automatically parses variables matching `/\$\{([^}\n]*)\}/g`.
  - Classifies statuses into **removed**, **new**, **changed** (usage count difference), and **same**.
  - Displays usage counts and line numbers for both previous and current prompts.
  - **Click to Jump**: Clicking a variable card scrolls to its occurrence in the diff and flashes the row with an outline for 1.8 seconds. Repeated clicks cycle through occurrences. If "Changes only" hides the line, it is automatically unhidden.

- **Broken Placeholder Scanner**:
  - Detects unclosed braces: `${weather` and `${broken and ${ok}`.
  - Detects missing `$` prefix: `{weather}` (while distinguishing from valid JSON like `{"key": "value"}`).
  - Detects unexpected spacing: `$ {weather}`.
  - Detects empty placeholders: `${}`.
  - Detects extra whitespace inside braces: `${ weather }`.
  - Reports line number, explanation, and a 70-character snippet.

- **Warning Callouts**:
  - Alerts when variables are removed (*"Make sure the code no longer expects it."*).
  - Alerts when variables are added (*"Make sure the code passes it."*).
  - Flags potential renames when both additions and removals occur simultaneously.
  - Flags count mismatches.

- **Developer Comments**:
  - Add inline comments on any non-removed line with an author name.
  - Fast $O(1)$ comment lookup powered by a line-text Map to keep 2,000+ line prompts snappy.
  - Stored locally in the browser via IndexedDB.

- **Version History**:
  - Save prompt snapshots with custom notes.
  - Restore snapshots directly to the **Previous** or **Current** prompt with one click.
  - Persisted in IndexedDB.

- **URL Hash Sharing (Serverless)**:
  - Generates shareable links encoded directly into the URL hash (`#d=...`).
  - Recipients open the exact same comparison without any backend or database.
  - Automatically warns if the URL exceeds 8,000 characters.

- **GitHub REST API Loader**:
  - Input a GitHub file URL (e.g., `https://github.com/owner/repo/blob/main/prompts/system.txt`).
  - Automatically loads the last two commits: older commit becomes Previous, newest becomes Current.
  - Optional Personal Access Token for private repositories (stored strictly in memory, never persisted).

- **Theme & Accessibility**:
  - Pure CSS design with CSS variables.
  - Automatic light and dark mode according to system preferences (`prefers-color-scheme`).
  - Full keyboard accessibility and visible focus styles.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Pure CSS with CSS variables (`app/globals.css`)
- **Diff Engine**: [`diff`](https://github.com/kpdecker/jsdiff) (jsdiff)
- **Storage**: [`idb-keyval`](https://github.com/jakearchibald/idb-keyval) (IndexedDB)
- **Testing**: [Vitest](https://vitest.dev/)
- **Linting**: [ESLint](https://eslint.org/) (`eslint-config-next`)

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Unit Tests

```bash
npm test
```

### 4. Run Linting

```bash
npm run lint
```

### 5. Build for Production

```bash
npm run build
npm start
```

---

## 🌐 Deploy to Vercel

`prompt-diff` is 100% frontend with zero server routes, making it completely plug-and-play with Vercel:

1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Vercel automatically detects Next.js:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
4. Click **Deploy**. No environment variables or database setup required!
