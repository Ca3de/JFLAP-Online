# JFLAP Online

Build and simulate DFAs, NFAs, pushdown automata and Turing machines in the
browser. No build step, no dependencies — static HTML, CSS and vanilla
JavaScript, deployed to GitHub Pages straight from the repository root.

## Worked examples

The point of the tool is the example library: fifteen machines, each with a
short note on *why* it is interesting and a set of strings that are known to be
in, and known to be out of, its language. Loading an example fills the batch
tester with those strings, so every claim the library makes can be checked in
one click.

| | |
|---|---|
| **DFA** | Garage Door Keypad · Vending Machine · C-Style Comment Scanner · Even 0s and Even 1s · Binary Divisible by 3 |
| **NFA** | Keypad — Code Anywhere · Ends with "01" · Email Pattern · (a\|b)\*abb with ε-moves |
| **PDA** | Balanced Parentheses · aⁿbⁿ · Even-Length Palindromes |
| **Turing** | Binary Increment · Palindrome Checker · Unary Addition |

Start with the **Garage Door Keypad** and then open **Keypad — Code Anywhere**.
They accept exactly the same language. The DFA needs twelve transitions and a
set of fall-back edges that are the failure function of the Knuth-Morris-Pratt
string matcher; the NFA needs six and a straight chain. Side by side they are
the clearest argument for nondeterminism there is.

## Using it

**Building.** Pick the state tool and click to place a state — the first one
becomes the start state. Pick the transition tool and drag from one state to
another. Double-click or right-click a state to rename it or make it accepting.
Hold <kbd>space</kbd> and drag to pan; scroll to zoom toward the cursor;
<kbd>F</kbd> fits the diagram to the window.

**Transition syntax**

- **DFA / NFA** — a comma-separated set of symbols, e.g. `2, 3, 4`. A DFA stays
  deterministic as long as the sets leaving a state are disjoint. `ε` for an
  epsilon move (NFA only).
- **PDA** — read, pop, push. A pop of `ε` pops nothing; the leftmost pushed
  character ends up on top. `Z` starts on the stack.
- **Turing machine** — read, write, direction. `□` is the blank symbol.

**Running.** *Run* plays the input through; *Step* advances one configuration.
The inspector shows the verdict, the input with the consumed prefix struck
through and the symbol under the head highlighted, the live state set, the PDA
stack, the TM tape and a step trace. *Batch test* takes one string per line —
write `ε` for the empty string.

**Themes.** Light and dark, remembered in `localStorage` and following the
system preference until you choose one. The canvas reads the same CSS custom
properties as the rest of the page, so the diagram follows the theme.

## Layout

Diagrams are laid out so that they stay readable without hand-tuning:

- A long edge that would pass through an intervening state is bowed outward
  until it clears — sampled against every other state centre, not guessed.
  Edges that dodge are deflected downward (self-loops own the space above a
  state) and nested at increasing depths where their spans overlap, so they do
  not land on one another. The vending machine is the case to look at.
- Two states joined in both directions get the same signed curvature. An edge's
  perpendicular flips when it runs the other way, so they separate on their own.
- Several self-loops on one state nest concentrically rather than fanning
  sideways, and each label sits at its curve's computed apex
  `(p0 + 3c1 + 3c2 + p3) / 8`.
- Labels that would collide are nudged apart along the direction that takes
  them away from their own curve.
- Fit-to-view includes edge bow and self-loop reach in its bounding box.

## Verifying

Two suites, both dependency-light and runnable offline:

```sh
node tools/verify-engine.js   # ~258 checks: every example's declared strings,
                              # DFA determinism, undo/redo, PDA acceptance, TM tapes
node tools/verify-ui.js       # ~56 checks in headless Chromium, plus screenshots
```

`verify-engine.js` concatenates the source files into a single script before
running them in one `vm` context — separate `runInContext` calls do not share
lexical scope, so `class` and `const` declarations would not be visible across
files.

`verify-ui.js` serves the repository, drives the real page in headless Chromium
(loads every example, runs simulations to a verdict, places states and drags
transitions with the mouse, toggles the theme, exercises undo/redo) and writes
screenshots to `tools/shots/`, which is git-ignored.

## Project layout

```
index.html              markup and script order
css/style.css           design tokens (light + dark) and all styling
js/core/                util, State, Transition, Automaton (history, JSON, JFLAP XML)
js/machines/            DFA, NFA, PDA, TuringMachine
js/data/examples.js     the example library
js/ui/CanvasRenderer    HiDPI canvas, theming, edge routing, self-loops
js/ui/CanvasEditor      mouse and keyboard interaction
js/ui/Simulator         the inspector panel and batch tester
js/app.js               application shell
tools/                  verification suites
```

## Deployment

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on
every push to `main`. There is nothing to build.
