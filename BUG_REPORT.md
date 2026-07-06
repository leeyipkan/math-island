# Math Island Game — Bug Report

## CRITICAL BUGS (crashes the game)

### BUG 1: `runCount` infinite loop when `count === 1`

**File:** `index.html`, lines 371-375
**Severity:** CRITICAL — freezes the browser tab

```js
let opts = new Set([count]);
while (opts.size < 4) {
  let d = count + Math.floor(Math.random() * 5) - 2;  // range: count-2 .. count+2
  if (d >= 1 && d <= max && d !== count) opts.add(d);
}
```

When the random count value is `1`, the range is `[-1, 0, 1, 2, 3]`. After filtering (`>=1, <=max, !==1`), only `[2, 3]` remain — at most 2 valid distractors. But the loop needs 3 more values (opts.size must reach 4). The loop spins forever.

**Reproducible:** ~50% of the time (since `count` is random 1..max). Affects all 3 count levels.

**Fix:** Expand the distractor range or pre-generate a pool of valid numbers and sample from it.

---

### BUG 2: `runSequence` infinite loop when `ans === 1` or `ans === 20`

**File:** `index.html`, lines 424-429
**Severity:** CRITICAL — freezes the browser tab

```js
while (opts.size < 4) {
  let d = ans + Math.floor(Math.random() * 5) - 2;  // range: ans-2 .. ans+2
  if (d >= 1 && d <= 20 && d !== ans) opts.add(d);
}
```

- **ans=1:** range is `[-1,0,1,2,3]` → valid values `[2,3]` — only 2 possible.
- **ans=20:** range is `[18,19,20,21,22]` → valid values `[18,19]` — only 2 possible.

The loop needs 3 unique distractors but nature only provides 2. Infinite loop.

**Fix:** Same approach — wider range or pre-generation of candidates.

---

### BUG 3: Zero mode (`runAddSub`) — answer doesn't match the question

**File:** `index.html`, lines 555-558
**Severity:** HIGH — game teaches wrong math / marks right answers as wrong

```js
if (z === 0) {
  q = `${Math.floor(Math.random()*5)+1}+0`;   // e.g., "3+0"
  a = Math.floor(Math.random()*5)+1;           // e.g., 5 ← WRONG! Should be 3
} else {
  q = `${Math.floor(Math.random()*5)+1}-0`;   // e.g., "4-0"
  a = Math.floor(Math.random()*5)+1;           // e.g., 1 ← WRONG! Should be 4
}
```

`a` is generated independently from the first operand. In ~80% of cases, `a` does not match the actual answer to the equation. The game tells the child "3+0 = 5" is correct.

**Fix:** Store the first operand and use it as the answer:
```js
const first = Math.floor(Math.random() * 5) + 1;
q = `${first}+0`;
a = first;
```

---

## MEDIUM BUGS

### BUG 4: Decompose game rejects valid answer when `a === b`

**File:** `index.html`, lines 525-543
**Severity:** MEDIUM — correct answer treated as wrong

When `total` is even and `a` randomly lands on `total/2`, both answers are the same number (e.g., total=10, a=5, b=5 → ans=[5,5]). The buttons show two "5" entries. `checkDec` checks `ans.includes(n) && !picked.includes(n)`. After clicking the first "5", `picked=[5]`. Clicking the second "5" hits `picked.includes(5) === true` and falls through to the `else if` branch, treated as WRONG.

**Occurrence:** ~5.6% of decompose rounds.

**Fix:** When `a === b`, deduplicate to a single target and only require 1 pick, or regenerate until `a !== b`.

---

### BUG 5: COINS array mutated in-place by `runCoinID`

**File:** `index.html`, line 651
**Severity:** LOW-MEDIUM (sloppy, could cause non-deterministic ordering issues)

```js
COINS.sort(() => Math.random() - .5)
```

`Array.sort()` is in-place, so the module-level `COINS` array gets shuffled every level. This is a side-effect on a "constant". Not currently breaking because no other code depends on coin order, but it's poor practice.

**Fix:** Use `[...COINS].sort(...)` for a copy.

---

## LOW SEVERITY BUGS / EDGE CASES

### BUG 6: Sequence game shows negative numbers in backward mode

**File:** `index.html`, lines 413-417

When `start=1`, the backward sequence is `[1, 0, -1, -2]`. These negative numbers appear in the UI for P1 students who only know positive numbers. Awkward but not game-breaking.

### BUG 7: Unused variable `display` in `runOddEven`

**File:** `index.html`, line 462

```js
const display = shuffled[Math.floor(Math.random() * shuffled.length)];
```

This variable is never read. Dead code.

### BUG 8: Corrupted localStorage crashes the entire app

**File:** `index.html`, lines 226-227

```js
progress: JSON.parse(localStorage.getItem('mathIsland') || '{}'),
stickers: JSON.parse(localStorage.getItem('mathIslandStickers') || '[]'),
```

No `try/catch`. If localStorage data is corrupted (e.g., truncated JSON from storage quota issues), `JSON.parse` throws and the entire page crashes on load.

### BUG 9: No user inactivity timeout

The game provides no feedback when the user does nothing. No hint system, no nudge, no idle timer. A young child might get stuck staring at a blank question.

### BUG 10: Hearts can go negative

If `checkCount` is called rapidly (multiple wrong clicks before the timeout), `state.hearts` decrements past 0. `'❤️'.repeat(-1)` returns `''`, which is handled gracefully by JS but the state is corrupted.

---

## iOS SAFARI & MOBILE NOTES

| Issue | Details |
|-------|---------|
| Touch events | Handled via `touch-action: manipulation` and `:active` CSS. No double-tap zoom. Good. |
| AudioContext | Lines 243-247 use `webkitAudioContext` fallback. Correct for iOS Safari. |
| `100dvh` | Line 14 uses `100dvh` which is supported in iOS 15.4+. Safe. |
| `-webkit-overflow-scrolling` | Line 35 uses this for map scroll. Deprecated but still works on iOS. |
| Backdrop-filter | Lines 60, 110 use `backdrop-filter`. Supported since iOS 8+ with `-webkit-` prefix (missing!). |

### Issue: Missing `-webkit-backdrop-filter`

Lines 60 and 110 use `backdrop-filter: blur(4px)` and `backdrop-filter: blur(6px)` without the `-webkit-` prefix. On very old iOS Safari (8-11.1), this won't work. However, iOS 11.3+ supports the unprefixed version. This is only an issue for very old devices.

---

## SUMMARY OF FIXES NEEDED

| # | Priority | Area | Problem |
|---|----------|------|---------|
| 1 | 🔴 CRITICAL | `runCount` | Infinite loop when count=1 |
| 2 | 🔴 CRITICAL | `runSequence` | Infinite loop when ans=1 or ans=20 |
| 3 | 🔴 CRITICAL | `runAddSub` (zero mode) | Answer doesn't match equation (~80% wrong) |
| 4 | 🟡 MEDIUM | `runDecompose` | Rejects valid answer when a==b (~5.6%) |
| 5 | 🟡 MEDIUM | `runCoinID` | Mutates global COINS array |
| 6 | 🟢 LOW | `runSequence` | Negative numbers in backward mode |
| 7 | 🟢 LOW | `runOddEven` | Dead code (unused `display` variable) |
| 8 | 🟢 LOW | Load | `JSON.parse` crash on corrupted localStorage |
| 9 | 🟢 LOW | UX | No idle timeout for stuck users |
| 10 | 🟢 LOW | Hearts | Can drop below 0 with rapid clicks |

**Most critical fix:** Bugs 1, 2, and 3 are game-breaking. Bug 3 actively teaches incorrect math.
