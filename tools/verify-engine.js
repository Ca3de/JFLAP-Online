/**
 * Headless engine check.
 *
 * The browser build has no module system - every file declares top-level
 * classes and relies on them sharing one global scope. Separate
 * vm.runInContext() calls each get their OWN lexical scope, so `class` and
 * `const` declarations made in one are invisible to the next. Concatenating
 * the sources into a single script is what reproduces the browser's scoping.
 *
 * Run: node tools/verify-engine.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
    'js/core/State.js',
    'js/core/Transition.js',
    'js/core/Automaton.js',
    'js/machines/DFA.js',
    'js/machines/NFA.js',
    'js/machines/PDA.js',
    'js/machines/TuringMachine.js',
    'js/data/examples.js'
];

// Top-level `class` / `const` land in the global LEXICAL scope, not on
// globalThis, so a bridge is appended to hand them back to the harness.
const BRIDGE = `
globalThis.__exports = {
    State, Transition, Automaton, DFA, NFA, PDA, TuringMachine,
    Examples, EXAMPLES, EXAMPLE_CATEGORIES
};
`;

const source = FILES
    .map(f => `/* ==== ${f} ==== */\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}`)
    .join('\n') + BRIDGE;

const context = vm.createContext({ console, module: undefined });
vm.runInContext(source, context, { filename: 'jflap-bundle.js' });

const { Examples, EXAMPLES } = context.__exports;

let checks = 0;
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const ok = () => { checks++; };

/* ------------------------------------------------------------ example suite */

console.log(`\nExamples (${EXAMPLES.length})\n`);

for (const example of EXAMPLES) {
    const cases = Examples.testStrings(example);
    let bad = 0;

    for (const testCase of cases) {
        const automaton = Examples.build(example);
        automaton.initSimulation(testCase.input);
        const got = automaton.run() === true;

        if (got !== testCase.expected) {
            bad++;
            fail(`${example.id}: "${Examples.encodeString(testCase.input)}" ` +
                 `expected ${testCase.expected ? 'accept' : 'reject'}, got ` +
                 `${got ? 'accept' : 'reject'}`);
        } else {
            ok();
        }
    }

    // Structural sanity: every transition symbol must be in the declared
    // alphabet, and the machine must have an initial and an accepting state.
    const automaton = Examples.build(example);
    if (!automaton.initialState) fail(`${example.id}: no initial state`);
    if (automaton.getFinalStates().length === 0) fail(`${example.id}: no final state`);

    const alphabet = new Set(example.alphabet);
    example.transitions.forEach(t => {
        if (example.type === 'tm') {
            [t.read, t.write].forEach(s => {
                if (s !== '□' && !alphabet.has(s)) {
                    fail(`${example.id}: tape symbol '${s}' not in declared alphabet`);
                }
            });
            if (!['L', 'R', 'S'].includes(t.move)) {
                fail(`${example.id}: bad move '${t.move}'`);
            }
        } else if (example.type === 'pda') {
            if (t.on !== 'ε' && !alphabet.has(t.on)) {
                fail(`${example.id}: input symbol '${t.on}' not in declared alphabet`);
            }
        } else {
            String(t.on).split(',').map(s => s.trim()).forEach(s => {
                if (s !== 'ε' && !alphabet.has(s)) {
                    fail(`${example.id}: symbol '${s}' not in declared alphabet`);
                }
            });
        }
    });

    // Duplicated test strings would silently weaken a suite.
    const seen = new Set();
    [...example.accept, ...example.reject].forEach(s => {
        if (seen.has(s)) fail(`${example.id}: duplicate test string "${s}"`);
        seen.add(s);
    });

    const status = bad === 0 ? 'ok  ' : 'FAIL';
    console.log(`  ${status}  ${example.type.toUpperCase().padEnd(3)}  ` +
                `${example.name.padEnd(28)} ${cases.length} strings`);
}

/* --------------------------------------------------------- determinism check */

console.log('\nDeterminism of the DFA examples\n');

for (const example of EXAMPLES.filter(e => e.type === 'dfa')) {
    const automaton = Examples.build(example);
    let conflicts = 0;

    automaton.states.forEach(state => {
        const seen = new Map();
        automaton.getTransitionsFrom(state).forEach(t => {
            t.symbols.forEach(sym => {
                if (seen.has(sym)) conflicts++;
                seen.set(sym, t);
            });
        });
        // A DFA here is also expected to be total except where the example
        // deliberately omits an edge (vending machine); only conflicts fail.
    });

    if (conflicts > 0) {
        fail(`${example.id}: ${conflicts} symbol(s) with more than one outgoing edge`);
    } else {
        ok();
        console.log(`  ok    ${example.name}`);
    }
}

/* ------------------------------------------------------------ history checks */

console.log('\nUndo / redo\n');

(function historyChecks() {
    const { DFA, State, Transition } = context.__exports;
    const a = new DFA();
    const s0 = new State({ name: 'q0', x: 10, y: 10 });
    const s1 = new State({ name: 'q1', x: 90, y: 10 });
    a.addState(s0);
    a.addState(s1);
    a.addTransition(new Transition({ fromState: s0, toState: s1, symbols: ['a'] }));

    if (a.states.length !== 2 || a.transitions.length !== 1) fail('history: bad setup');

    if (!a.undo()) fail('undo: refused the first undo');
    if (a.transitions.length !== 0) fail('undo: transition was not removed');
    if (a.states.length !== 2) fail('undo: states changed unexpectedly');

    // The bug: undo() used to call loadFromJSON(), which clears history,
    // leaving nothing to redo into.
    if (!a.canRedo()) fail('redo: history was destroyed by undo');
    if (!a.redo()) fail('redo: refused');
    if (a.transitions.length !== 1) fail('redo: transition was not restored');
    ok();
    console.log('  ok    undo then redo round-trips');

    // Walk the whole timeline backwards and forwards.
    let steps = 0;
    while (a.undo()) steps++;
    if (steps === 0) fail('undo: could not walk back');
    let forward = 0;
    while (a.redo()) forward++;
    if (forward !== steps) fail(`redo: walked back ${steps} but forward ${forward}`);
    ok();
    console.log(`  ok    timeline walks back and forward (${steps} steps)`);

    // historyIndex must not drift once the ring buffer is trimmed.
    const b = new DFA();
    b.maxHistory = 5;
    for (let i = 0; i < 12; i++) {
        b.addState(new State({ name: `q${i}`, x: i * 40, y: 0 }));
    }
    if (b.historyIndex !== b.history.length - 1) {
        fail(`saveToHistory: index ${b.historyIndex} but ${b.history.length} snapshots`);
    } else {
        ok();
        console.log('  ok    historyIndex tracks a trimmed buffer');
    }
    b.undo();
    if (b.states.length !== 11) {
        fail(`undo after trimming restored ${b.states.length} states, expected 11`);
    } else {
        ok();
        console.log('  ok    undo still correct after trimming');
    }

    // Loading a machine must NOT be undoable back into the previous one.
    const c = new DFA();
    c.addState(new State({ name: 'z0', x: 0, y: 0 }));
    c.addState(new State({ name: 'z1', x: 40, y: 0 }));
    c.loadFromJSON(Examples.build(Examples.byId('even-even')).toJSON());
    if (c.canUndo()) {
        fail('loadFromJSON: the freshly opened machine is undoable into the old one');
    } else {
        ok();
        console.log('  ok    loading a machine starts a fresh timeline');
    }
})();

/* ----------------------------------------------------------------- PDA extras */

console.log('\nPDA engine\n');

(function pdaChecks() {
    // An accepting configuration with NO outgoing transitions must still
    // accept - it used to be dropped before acceptance was ever checked.
    const pda = Examples.build(Examples.byId('anbn'));
    pda.initSimulation('aabb');
    if (pda.run() !== true) {
        fail('PDA: aabb rejected (accepting configuration dropped?)');
    } else {
        ok();
        console.log('  ok    accepting configuration with no successors accepts');
    }

    // Deduplication: without it the palindrome PDA explodes. Bound the work.
    const pal = Examples.build(Examples.byId('palindrome-pda'));
    pal.initSimulation('abbaabbaabba'.slice(0, 12));
    let maxFrontier = 0;
    pal.initSimulation('aabbbbaa');
    while (pal.configurations.length > 0 && pal.isAccepted === null) {
        maxFrontier = Math.max(maxFrontier, pal.configurations.length);
        if (!pal.step()) break;
    }
    if (maxFrontier > 64) {
        fail(`PDA: frontier grew to ${maxFrontier} configurations - dedup not working`);
    } else {
        ok();
        console.log(`  ok    frontier stays small (peak ${maxFrontier} configurations)`);
    }
})();

/* ---------------------------------------------------------------- TM outputs */

console.log('\nTuring machine tape output\n');

(function tmChecks() {
    const trim = (tape) => tape.replace(/□/g, ' ').trim();
    const cases = [
        ['binary-increment', '1011', '1100'],
        ['binary-increment', '111', '1000'],
        ['binary-increment', '0', '1'],
        ['binary-increment', '10011', '10100'],
        ['unary-add', '111+11', '11111'],
        ['unary-add', '1+1', '11'],
        ['unary-add', '+1', '1']
    ];

    cases.forEach(([id, input, expected]) => {
        const tm = Examples.build(Examples.byId(id));
        tm.initSimulation(input);
        tm.run();
        const got = trim(tm.getTapeString());
        if (got !== expected) {
            fail(`${id}: "${input}" left "${got}" on the tape, expected "${expected}"`);
        } else {
            ok();
            console.log(`  ok    ${id}: ${input} -> ${got}`);
        }
    });
})();

/* --------------------------------------------------------------------- done */

const total = checks + failures;
console.log(`\n${checks}/${total} checks passed${failures ? `, ${failures} FAILED` : ''}\n`);
process.exit(failures === 0 ? 0 : 1);
