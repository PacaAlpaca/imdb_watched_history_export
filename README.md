# IMDb Watch History → CSV

A single-file browser console script that exports your IMDb **Watch history** - including your own ratings - to a CSV file.

No extension, no API key, no third-party service. It reads the page you already have open in your browser and downloads a file; it makes no network requests of its own and sends nothing anywhere.

## What it exports

One row per entry, handling both films and TV episodes:

```
position, type, title, series_title, episode, year, runtime, certificate,
imdb_rating, num_votes, my_rating, directors, creators, stars, description,
imdb_id, series_imdb_id, url
```

| | film | TV episode |
|---|---|---|
| `title` | The Drama | Welcome to the Playground |
| `series_title` | *(empty)* | Arcane |
| `episode` | *(empty)* | S1.E1 |
| `year` | 2026 | 2021–2024 |
| `imdb_rating` / `my_rating` | 7.1 / 8 | 8.5 / 9 |

`my_rating` is empty for anything you haven't rated. `directors` and `creators` are separate columns because IMDb labels series differently from films; multiple names are joined with `; `.

## How to use

1. Log in to IMDb and open your watch history in **detailed** view:
   `https://www.imdb.com/list/watchhistory/?ref_=cr_lst_nv_wtchd&view=detailed`
2. Open DevTools (<kbd>F12</kbd>, or <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>J</kbd> on macOS) → Console .
3. Chrome/Edge may refuse the first paste into the console - type `allow pasting`, press Enter, then continue.
4. Paste the contents of [`imdb-watch-history-export.js`](imdb-watch-history-export.js) and press Enter.
5. The script scrolls to the bottom to load every row, logs its progress, and downloads `imdb-watch-history-YYYY-MM-DD.csv`.

If the browser blocks the download, everything is still in memory - run `copy(window.__imdb.csv)` to put the CSV on your clipboard.

## Options

Edit the `CONFIG` block at the top of the file:

| Option | Default | |
|---|---|---|
| `alsoJson` | `false` | Also download a `.json` copy |
| `delimiter` | `,` | Use `;` if your Excel locale expects semicolons |

## Notes and limitations

- IMDb has a built-in export for some list (on top right side: Actions → Export). It is not available for watch history, but for normal lists that's the more robust backup - this script is for when it isn't.
