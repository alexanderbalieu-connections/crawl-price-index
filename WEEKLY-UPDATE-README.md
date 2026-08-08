# Your weekly job: one double-click

Once everything is set up (see one-time step below), your entire upkeep is:

**Double-click `weekly-update.command` in Finder. Watch it run. Close it.**

It scans the web, rebuilds the site data, and publishes. ~5 minutes, mostly
waiting. If your wifi hiccups or a site blocks you, it safely refuses to
publish and leaves your live site untouched — so you can never break it.

You don't *have* to run it weekly. Skip a week, skip a month — the site keeps
working. Running it just adds another dated snapshot to the history, which is
the part competitors can't copy. Run it when you remember.

---

## One-time setup (~5 min, do this once with Claude)

The script publishes by pushing to your GitHub repo. Your Mac needs to be
connected to that repo once. With Claude's help:

1. Open Terminal, and point it at your project folder (Claude will give you the
   exact `cd` line for where you unzipped it).
2. Connect the folder to your repo (one-time git setup — Claude walks you
   through: `git init`, `git remote add`, sign in to GitHub).
3. First manual `git push` to confirm it works.

After that, the double-click handles everything forever.

---

## Two things you can tune (optional)

- **Scan size.** The script runs `--top 2000` by default. Once you've seen a
  clean run, open `weekly-update.command` in TextEdit and change `--top 2000`
  to `--top 10000` for bigger country samples (India, Japan, Gulf appear at
  that depth). It'll take longer but is otherwise identical.

- **First time it won't open?** macOS may warn about an unsigned script.
  Right-click the file → Open → Open, just the first time. After that,
  double-click works normally.
