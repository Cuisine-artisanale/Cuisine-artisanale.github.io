---
name: code-style
description: Code style for the Cuisine Artisanale project. Use whenever writing, editing or reviewing any code file (.ts, .tsx, .js, .mjs, .css, .scss, .json) in this repo, and when the user asks to fix indentation or reformat code.
---

# Code style — Cuisine Artisanale

## Indentation: tabs, never spaces

- Indent with **one tab character (`\t`) per level**, in every code file: TS, TSX, JS, MJS, CSS, SCSS, JSON (`package.json`, `firebase.json`…).
- Never indent with 2 or 4 spaces, even if the surrounding code still uses spaces: new or modified lines use tabs.
- Spaces are only allowed **after** the tabs for alignment, e.g. the ` * ` of a JSDoc block:

```ts
/**
 * Formats a quantity.
 */
export function formatAmount(value: number) {
	if (value <= 0) {
		return '';
	}
	return value.toString();
}
```

```css
.admin-panel {
	display: flex;
	align-items: stretch;
	border-radius: 14px;
}
```

```tsx
return (
	<div className="card">
		<p>{label}</p>
	</div>
);
```

## Exceptions (do not convert)

- `package-lock.json`: formatted by npm, never touch it by hand.
- Content inside template literals (`` `...` ``) such as HTML emails: the leading spaces are part of the string.
- `.md` files.

## Editing an existing file that still uses spaces

- When you change a few lines, write those lines with tabs **and** convert the indentation of the whole block/function you touch, so it stays consistent.
- If the user asks to convert a whole file, replace each group of 2 leading spaces with one tab (an odd leftover space stays as alignment), without changing anything else (quotes, line breaks, logic).
- Since the Edit tool requires an exact match, read the file first to see whether it currently uses spaces or tabs before writing `old_string`.

## Other conventions already used in the repo

- Single quotes `'...'` in TS/JS, semicolons at the end of statements.
- Before finishing: `npm run typecheck` and `npx eslint .` (0 errors).
