# IMDb Watch History → CSV

Exports your IMDb **Watch history** (films, series and episodes, with your own ratings) to a CSV file. IMDb has an Export button for normal lists, but not for watch history.

Scrpt reads the page you already have open in your browser and downloads a file; it makes no network requests of its own and sends nothing anywhere.

## Notes and limitations

- IMDb has a built-in export for some list (on top right side: Actions → Export). It is not available for watch history, but for normal lists that's the more robust backup - this script is for when it isn't.

## How to use

1. Log in to IMDb and open your watch history in **detailed** view:
   `https://www.imdb.com/list/watchhistory/?ref_=cr_lst_nv_wtchd&view=detailed`
2. Open DevTools (<kbd>F12</kbd>, or <kbd>Cmd</kbd>+<kbd>Opt</kbd>+<kbd>J</kbd> on macOS) and open the **Console** tab .
3. Chrome/Edge may refuse the first paste into the console - type `allow pasting`, press Enter, then continue.
4. Paste the whole content of [`imdb-watch-history-export.js`](imdb-watch-history-export.js) and press Enter.
   Chrome/Edge may first ask you to type `allow pasting` - type it, press Enter, then paste again.
5. Wait - the page scrolls by itself. When it is done, the browser saves `imdb-watch-history-YYYY-MM-DD.csv` (it may ask you where to save it).

If the browser blocks the download, everything is still in memory - run `copy(window.__imdb.csv)` to put the CSV on your clipboard.

## Options

Edit the `CONFIG` block at the top of the file:

| Option | Default | |
|---|---|---|
| `alsoJson` | `false` | Also download a `.json` copy |
| `delimiter` | `,` | Use `;` if your Excel locale expects semicolons |


## What it exports

One row per entry, handling both films and TV episodes:

One row per title: type, title, series name and episode number (e.g. `S1.E1`) for episodes, year, runtime, IMDb rating, **your rating** (empty if not rated), directors / creators, stars, plot, IMDb ID and link.

Excel shows everything in one column? At the top of the script change `delimiter: ','` to `delimiter: ';'` and run it again.

| | film | TV episode |
|---|---|---|
| `title` | The Drama | Welcome to the Playground |
| `series_title` | *(empty)* | Arcane |
| `episode` | *(empty)* | S1.E1 |
| `year` | 2026 | 2021–2024 |
| `imdb_rating` / `my_rating` | 7.1 / 8 | 8.5 / 9 |

`my_rating` is empty for anything you haven't rated. `directors` and `creators` are separate columns because IMDb labels series differently from films; multiple names are joined with `; `.
