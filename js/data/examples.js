/**
 * A library of worked examples.
 *
 * Every example carries its own accept / reject strings; they populate the
 * batch tester when the example is loaded, so any claim made here can be
 * checked in one click.
 *
 * Transition shorthand:
 *   DFA / NFA : { from, to, on: '0,1' }        ('' or 'ε' for an epsilon move)
 *   PDA       : { from, to, on: 'a', pop: 'Z', push: 'AZ' }
 *               pop is only popped when it is not 'ε'; the LEFTMOST character
 *               of push ends up on top of the stack.
 *   TM        : { from, to, read: '0', write: '1', move: 'L' }   blank is '□'
 */

const EXAMPLE_CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'dfa', label: 'DFA' },
    { id: 'nfa', label: 'NFA' },
    { id: 'pda', label: 'PDA' },
    { id: 'tm', label: 'Turing' }
];

const EXAMPLES = [
    /* ------------------------------------------------------------------ DFA */
    {
        id: 'keypad',
        name: 'Garage Door Keypad',
        type: 'dfa',
        featured: true,
        blurb: 'Opens on the code 1-2-3-4, typed anywhere in the stream.',
        idea: `A keypad watches an endless stream of key presses for the code 1-2-3-4. The subtle part is what happens on a wrong key: the machine must NOT simply reset to the start. After 1-2-3 a further 1 leaves you one symbol into the code again, not back at nothing. Those fall-back edges are exactly the failure function of the Knuth-Morris-Pratt string matcher, drawn out as a diagram — every state remembers the longest suffix of what you have typed that is still a prefix of the code.`,
        alphabet: ['1', '2', '3', '4'],
        states: [
            { name: 'LOCKED', x: 130, y: 230, initial: true },
            { name: 'q1', x: 330, y: 230 },
            { name: 'q2', x: 530, y: 230 },
            { name: 'q3', x: 730, y: 230 },
            { name: 'OPEN', x: 930, y: 230, final: true }
        ],
        transitions: [
            { from: 'LOCKED', to: 'q1', on: '1' },
            { from: 'LOCKED', to: 'LOCKED', on: '2, 3, 4' },
            { from: 'q1', to: 'q1', on: '1' },
            { from: 'q1', to: 'q2', on: '2' },
            { from: 'q1', to: 'LOCKED', on: '3, 4' },
            { from: 'q2', to: 'q1', on: '1' },
            { from: 'q2', to: 'q3', on: '3' },
            { from: 'q2', to: 'LOCKED', on: '2, 4' },
            { from: 'q3', to: 'q1', on: '1' },
            { from: 'q3', to: 'OPEN', on: '4' },
            { from: 'q3', to: 'LOCKED', on: '2, 3' },
            { from: 'OPEN', to: 'OPEN', on: '1, 2, 3, 4' }
        ],
        accept: ['1234', '111234', '1231234', '4321234', '12341234', '3121234', '1121234'],
        reject: ['ε', '1', '12', '123', '124', '1243', '4321', '1232', '12314', '11223344']
    },
    {
        id: 'vending',
        name: 'Vending Machine',
        type: 'dfa',
        blurb: 'Nickels, dimes and quarters up to exactly 30¢ — no change given.',
        idea: `Each state is an amount of money banked so far, so the diagram is a number line and every coin is a jump along it. Because the machine gives no change, there is deliberately no transition out of a state when the coin would overshoot 30¢: a missing edge is the machine refusing the coin, and an input that needs one is rejected. Watch out for how easy it is to misread a sequence — 'dnd' looks like it should work and is only 25¢.`,
        alphabet: ['n', 'd', 'q'],
        states: [
            { name: '0¢', x: 110, y: 220, initial: true },
            { name: '5¢', x: 260, y: 220 },
            { name: '10¢', x: 410, y: 220 },
            { name: '15¢', x: 560, y: 220 },
            { name: '20¢', x: 710, y: 220 },
            { name: '25¢', x: 860, y: 220 },
            { name: '30¢', x: 1010, y: 220, final: true }
        ],
        transitions: [
            { from: '0¢', to: '5¢', on: 'n' },
            { from: '0¢', to: '10¢', on: 'd' },
            { from: '0¢', to: '25¢', on: 'q' },
            { from: '5¢', to: '10¢', on: 'n' },
            { from: '5¢', to: '15¢', on: 'd' },
            { from: '5¢', to: '30¢', on: 'q' },
            { from: '10¢', to: '15¢', on: 'n' },
            { from: '10¢', to: '20¢', on: 'd' },
            { from: '15¢', to: '20¢', on: 'n' },
            { from: '15¢', to: '25¢', on: 'd' },
            { from: '20¢', to: '25¢', on: 'n' },
            { from: '20¢', to: '30¢', on: 'd' },
            { from: '25¢', to: '30¢', on: 'n' }
        ],
        accept: ['qn', 'nq', 'ddd', 'ddnn', 'dnnnn', 'nnnnnn', 'dndn', 'nnnnd'],
        reject: ['ε', 'n', 'd', 'q', 'dd', 'nnn', 'dnd', 'qq', 'qd', 'ddddd', 'nnnnnnn']
    },
    {
        id: 'comment-scanner',
        name: 'C-Style Comment Scanner',
        type: 'dfa',
        blurb: 'Finds a complete /* … */ comment. x stands for any other character.',
        idea: `This is the scanner every compiler front end contains. Two details make it more than a chain: inside a comment a lone * might be the start of the closing */ or just a star, and outside a comment a second / keeps you in the "just saw a slash" state rather than dropping you back to the beginning. Once a complete comment has been seen the machine latches — it is answering "does this text contain a comment", not "is this text a comment".`,
        alphabet: ['/', '*', 'x'],
        states: [
            { name: 'TEXT', x: 140, y: 240, initial: true },
            { name: 'SLASH', x: 360, y: 240 },
            { name: 'IN', x: 580, y: 240 },
            { name: 'STAR', x: 800, y: 240 },
            { name: 'DONE', x: 1020, y: 240, final: true }
        ],
        transitions: [
            { from: 'TEXT', to: 'SLASH', on: '/' },
            { from: 'TEXT', to: 'TEXT', on: '*, x' },
            { from: 'SLASH', to: 'IN', on: '*' },
            { from: 'SLASH', to: 'SLASH', on: '/' },
            { from: 'SLASH', to: 'TEXT', on: 'x' },
            { from: 'IN', to: 'STAR', on: '*' },
            { from: 'IN', to: 'IN', on: '/, x' },
            { from: 'STAR', to: 'DONE', on: '/' },
            { from: 'STAR', to: 'STAR', on: '*' },
            { from: 'STAR', to: 'IN', on: 'x' },
            { from: 'DONE', to: 'DONE', on: '/, *, x' }
        ],
        accept: ['/**/', '/*x*/', '/*xx**/', 'x/*x*/x', '/*/**/', '//*x*/', '/*x*/x/*x*/'],
        reject: ['ε', '/', '//', '/*', '/**', '/*x', '*/', '*/*', 'xxx', 'x/*xx', '***']
    },
    {
        id: 'even-even',
        name: 'Even 0s and Even 1s',
        type: 'dfa',
        blurb: 'Accepts binary strings with an even count of both symbols.',
        idea: `Two independent yes/no facts — is the number of 0s even, is the number of 1s even — give four states arranged as a 2×2 grid. Reading a 0 flips you across one axis, reading a 1 flips you across the other, and every edge has a twin running back the other way because flipping twice returns you where you started. It is the cleanest picture of a product construction there is: two one-bit machines running side by side in a single diagram.`,
        alphabet: ['0', '1'],
        states: [
            { name: 'EE', x: 340, y: 190, initial: true, final: true },
            { name: 'EO', x: 620, y: 190 },
            { name: 'OE', x: 340, y: 430 },
            { name: 'OO', x: 620, y: 430 }
        ],
        transitions: [
            { from: 'EE', to: 'OE', on: '0' },
            { from: 'EE', to: 'EO', on: '1' },
            { from: 'OE', to: 'EE', on: '0' },
            { from: 'OE', to: 'OO', on: '1' },
            { from: 'EO', to: 'OO', on: '0' },
            { from: 'EO', to: 'EE', on: '1' },
            { from: 'OO', to: 'EO', on: '0' },
            { from: 'OO', to: 'OE', on: '1' }
        ],
        accept: ['ε', '00', '11', '0011', '1100', '0101', '1010', '0110', '110000'],
        reject: ['0', '1', '01', '10', '001', '010', '111', '0001']
    },
    {
        id: 'div-by-3',
        name: 'Binary Divisible by 3',
        type: 'dfa',
        blurb: 'Reads a binary numeral most-significant bit first and tracks it mod 3.',
        idea: `A finite machine cannot hold the number — it can be arbitrarily large — but it does not need to. Appending a bit b to a numeral with value r turns it into 2r + b, and that operation is well defined on the remainder alone. Three states are therefore enough to divide any binary numeral, however long, by three. The same trick works for any modulus, which is why this is the standard proof that "divisible by k" is a regular language.`,
        alphabet: ['0', '1'],
        states: [
            { name: 'r0', x: 480, y: 160, initial: true, final: true },
            { name: 'r1', x: 700, y: 440 },
            { name: 'r2', x: 260, y: 440 }
        ],
        transitions: [
            { from: 'r0', to: 'r0', on: '0' },
            { from: 'r0', to: 'r1', on: '1' },
            { from: 'r1', to: 'r2', on: '0' },
            { from: 'r1', to: 'r0', on: '1' },
            { from: 'r2', to: 'r1', on: '0' },
            { from: 'r2', to: 'r2', on: '1' }
        ],
        accept: ['ε', '0', '11', '110', '1001', '1100', '0000', '11110', '111111'],
        reject: ['1', '10', '100', '101', '111', '1011', '1101', '10000']
    },

    /* ------------------------------------------------------------------ NFA */
    {
        id: 'keypad-nfa',
        name: 'Keypad — Code Anywhere',
        type: 'nfa',
        featured: true,
        blurb: 'The same language as the keypad DFA, as an NFA. Compare the two.',
        idea: `Exactly the same language as the Garage Door Keypad, written the obvious way: skip anything, spell 1-2-3-4, then skip anything. No failure function, no fall-back edges, nothing to get wrong. The machine simply guesses where the code starts and is allowed to be wrong as long as one guess works out. Load this next to the DFA — the gap between the two diagrams is the single clearest argument for why nondeterminism is worth having.`,
        alphabet: ['1', '2', '3', '4'],
        states: [
            { name: 'scan', x: 160, y: 230, initial: true },
            { name: 'n1', x: 360, y: 230 },
            { name: 'n2', x: 560, y: 230 },
            { name: 'n3', x: 760, y: 230 },
            { name: 'open', x: 960, y: 230, final: true }
        ],
        transitions: [
            { from: 'scan', to: 'scan', on: '1, 2, 3, 4' },
            { from: 'scan', to: 'n1', on: '1' },
            { from: 'n1', to: 'n2', on: '2' },
            { from: 'n2', to: 'n3', on: '3' },
            { from: 'n3', to: 'open', on: '4' },
            { from: 'open', to: 'open', on: '1, 2, 3, 4' }
        ],
        accept: ['1234', '111234', '1231234', '4321234', '12341234', '3121234', '1121234'],
        reject: ['ε', '1', '12', '123', '124', '1243', '4321', '1232', '12314', '11223344']
    },
    {
        id: 'ends-01',
        name: 'Ends with "01"',
        type: 'nfa',
        blurb: 'Three states and a guess, where a DFA needs a dead end for every prefix.',
        idea: `The start state loops on everything and also offers a 0 that commits to "this is the final 01". Nothing in the machine decides which branch is right; both are explored and acceptance needs only one to survive to the end of the input. Run it one step at a time and watch the set of current states — that set is precisely the state the subset construction would build if you turned this into a DFA.`,
        alphabet: ['0', '1'],
        states: [
            { name: 'scan', x: 220, y: 240, initial: true },
            { name: 'saw0', x: 460, y: 240 },
            { name: 'saw01', x: 700, y: 240, final: true }
        ],
        transitions: [
            { from: 'scan', to: 'scan', on: '0, 1' },
            { from: 'scan', to: 'saw0', on: '0' },
            { from: 'saw0', to: 'saw01', on: '1' }
        ],
        accept: ['01', '001', '101', '1101', '0101', '000101', '11101'],
        reject: ['ε', '0', '1', '10', '011', '0110', '100', '0010']
    },
    {
        id: 'email',
        name: 'Email Pattern',
        type: 'nfa',
        blurb: 'user@domain.tld, where a stands for any letter.',
        idea: `Letters are collapsed to a single symbol a so the shape of the pattern is visible: one or more letters, an @, then dot-separated labels, the last of which is the top-level domain. The nondeterminism sits on the dot — reading one, the machine cannot know whether another subdomain follows or whether the TLD has begun, so it guesses both. That is why a@mail.example.com and a@example.com are both matched by one small diagram.`,
        alphabet: ['a', '@', '.'],
        states: [
            { name: 'start', x: 140, y: 240, initial: true },
            { name: 'user', x: 320, y: 240 },
            { name: 'dom0', x: 500, y: 240 },
            { name: 'dom', x: 680, y: 240 },
            { name: 'tld0', x: 860, y: 240 },
            { name: 'tld', x: 1040, y: 240, final: true }
        ],
        transitions: [
            { from: 'start', to: 'user', on: 'a' },
            { from: 'user', to: 'user', on: 'a' },
            { from: 'user', to: 'dom0', on: '@' },
            { from: 'dom0', to: 'dom', on: 'a' },
            { from: 'dom', to: 'dom', on: 'a' },
            { from: 'dom', to: 'tld0', on: '.' },
            { from: 'dom', to: 'dom0', on: '.' },
            { from: 'tld0', to: 'tld', on: 'a' },
            { from: 'tld', to: 'tld', on: 'a' }
        ],
        accept: ['a@a.a', 'aa@aa.aa', 'a@a.a.a', 'aaa@a.aa.aaa', 'aa@a.a', 'a@aa.aa.aa'],
        reject: ['ε', 'a', 'aaa', 'a.a', 'a@a', '@a.a', 'a@.a', 'aa@aa.', 'a@a.a@a']
    },
    {
        id: 'abb',
        name: '(a|b)*abb with ε-moves',
        type: 'nfa',
        blurb: 'The textbook NFA, including a transition that consumes nothing.',
        idea: `The machine every compilers course builds from the regular expression (a|b)*abb. The ε-edge is the join between the two halves of the expression: it moves the machine from "still skipping" into "now matching abb" without reading a symbol, which is exactly what concatenation means when you translate a regex into a machine. Reset and step through it — the ε-closure is taken before the first symbol is ever read.`,
        alphabet: ['a', 'b'],
        states: [
            { name: 'skip', x: 180, y: 240, initial: true },
            { name: 'go', x: 380, y: 240 },
            { name: 'a', x: 580, y: 240 },
            { name: 'ab', x: 780, y: 240 },
            { name: 'abb', x: 980, y: 240, final: true }
        ],
        transitions: [
            { from: 'skip', to: 'skip', on: 'a, b' },
            { from: 'skip', to: 'go', on: 'ε' },
            { from: 'go', to: 'a', on: 'a' },
            { from: 'a', to: 'ab', on: 'b' },
            { from: 'ab', to: 'abb', on: 'b' }
        ],
        accept: ['abb', 'aabb', 'babb', 'ababb', 'bbabb', 'abbabb'],
        reject: ['ε', 'a', 'ab', 'bb', 'aab', 'bab', 'abba', 'abbb']
    },

    /* ------------------------------------------------------------------ PDA */
    {
        id: 'balanced',
        name: 'Balanced Parentheses',
        type: 'pda',
        blurb: 'The canonical non-regular language, in two states and three edges.',
        idea: `Push on every open bracket, pop on every close. No finite machine can do this — it would have to count arbitrarily deep — but a stack does it with three rules. The third edge is the one worth studying: an ε-move to the accepting state that is only available when Z is back on top, which is how the machine checks that everything pushed was matched. Remove it and "(((" would be accepted.`,
        alphabet: ['(', ')'],
        states: [
            { name: 'match', x: 340, y: 260, initial: true },
            { name: 'done', x: 660, y: 260, final: true }
        ],
        transitions: [
            { from: 'match', to: 'match', on: '(', pop: 'ε', push: 'X' },
            { from: 'match', to: 'match', on: ')', pop: 'X', push: 'ε' },
            { from: 'match', to: 'done', on: 'ε', pop: 'Z', push: 'Z' }
        ],
        accept: ['ε', '()', '(())', '()()', '((()))', '(()())', '()(())'],
        reject: ['(', ')', '((', '))', '(()', '())', ')(', ')()', '(()))']
    },
    {
        id: 'anbn',
        name: 'aⁿbⁿ',
        type: 'pda',
        blurb: 'Equal numbers of a then b — the standard pumping-lemma victim.',
        idea: `The machine stacks an A for every a, then spends them one per b. The ε-move in the middle is the machine deciding that the a's are over, with nothing in the input to tell it so; the ε-move at the end checks that the stack is back to Z, i.e. that the counts matched exactly. This is the language used to prove that finite automata are strictly weaker than pushdown automata.`,
        alphabet: ['a', 'b'],
        states: [
            { name: 'push', x: 240, y: 260, initial: true },
            { name: 'pop', x: 540, y: 260 },
            { name: 'done', x: 840, y: 260, final: true }
        ],
        transitions: [
            { from: 'push', to: 'push', on: 'a', pop: 'ε', push: 'A' },
            { from: 'push', to: 'pop', on: 'ε', pop: 'ε', push: 'ε' },
            { from: 'pop', to: 'pop', on: 'b', pop: 'A', push: 'ε' },
            { from: 'pop', to: 'done', on: 'ε', pop: 'Z', push: 'Z' }
        ],
        accept: ['ε', 'ab', 'aabb', 'aaabbb', 'aaaabbbb', 'aaaaabbbbb'],
        reject: ['a', 'b', 'ba', 'aab', 'abb', 'abab', 'aabbb', 'aaabb', 'bbaa']
    },
    {
        id: 'palindrome-pda',
        name: 'Even-Length Palindromes',
        type: 'pda',
        blurb: 'w wᴿ over {a,b} — the machine has to guess the midpoint.',
        idea: `Push the first half, pop the second half and check each symbol matches. Nothing marks the midpoint, so the machine guesses it at every position and accepts if any guess works; on a string of length n there are n+1 guesses live at once. This is genuine nondeterminism that cannot be removed — no deterministic pushdown automaton recognises this language, which makes it the standard separation between DPDAs and PDAs.`,
        alphabet: ['a', 'b'],
        states: [
            { name: 'push', x: 240, y: 260, initial: true },
            { name: 'pop', x: 540, y: 260 },
            { name: 'done', x: 840, y: 260, final: true }
        ],
        transitions: [
            { from: 'push', to: 'push', on: 'a', pop: 'ε', push: 'A' },
            { from: 'push', to: 'push', on: 'b', pop: 'ε', push: 'B' },
            { from: 'push', to: 'pop', on: 'ε', pop: 'ε', push: 'ε' },
            { from: 'pop', to: 'pop', on: 'a', pop: 'A', push: 'ε' },
            { from: 'pop', to: 'pop', on: 'b', pop: 'B', push: 'ε' },
            { from: 'pop', to: 'done', on: 'ε', pop: 'Z', push: 'Z' }
        ],
        accept: ['ε', 'aa', 'bb', 'abba', 'baab', 'bbbb', 'aabbaa', 'abaaba'],
        reject: ['a', 'b', 'ab', 'aba', 'abb', 'aab', 'abab', 'baba', 'aaab']
    },

    /* ------------------------------------------------------- Turing machines */
    {
        id: 'binary-increment',
        name: 'Binary Increment',
        type: 'tm',
        blurb: 'Adds one to a binary numeral in place. 1011 becomes 1100.',
        idea: `Run to the right-hand end, then walk back left turning 1s into 0s until the first 0 becomes a 1 — school-book carrying, done by a machine with three states. The verdict is not the interesting part here; the tape is. Try 111: the carry propagates off the left end of the input, the machine writes a fresh 1 into a cell that was blank, and the tape grows to 1000. That is a Turing machine doing something no finite automaton can — using unbounded space it allocates as it goes.`,
        alphabet: ['0', '1'],
        states: [
            { name: 'right', x: 260, y: 250, initial: true },
            { name: 'add', x: 560, y: 250 },
            { name: 'done', x: 860, y: 250, final: true }
        ],
        transitions: [
            { from: 'right', to: 'right', read: '0', write: '0', move: 'R' },
            { from: 'right', to: 'right', read: '1', write: '1', move: 'R' },
            { from: 'right', to: 'add', read: '□', write: '□', move: 'L' },
            { from: 'add', to: 'add', read: '1', write: '0', move: 'L' },
            { from: 'add', to: 'done', read: '0', write: '1', move: 'L' },
            { from: 'add', to: 'done', read: '□', write: '1', move: 'R' }
        ],
        accept: ['0', '1', '10', '101', '111', '1011', '1111', '10011'],
        reject: ['2', '1x0', '01201'],
        note: 'Rejected inputs are the ones that are not binary at all — the machine halts with no rule to follow. For accepted inputs, read the answer off the tape.'
    },
    {
        id: 'palindrome-tm',
        name: 'Palindrome Checker',
        type: 'tm',
        blurb: 'Matches the ends of the tape inwards, erasing as it goes.',
        idea: `Erase the first symbol, remember it in the machine's own state, run to the far end and check the last symbol matches — then repeat on what is left. Unlike the pushdown version this needs no guessing and handles odd lengths too, because the head can revisit the tape as often as it likes. The three self-loops that just walk the head along are worth noticing: most of a Turing machine's work is travel.`,
        alphabet: ['a', 'b'],
        states: [
            { name: 'start', x: 150, y: 210, initial: true },
            { name: 'haveA', x: 420, y: 90 },
            { name: 'matchA', x: 700, y: 90 },
            // 'back' sits clear of the straight start -> yes line, so that edge
            // needs no deflection; the gap below it leaves room for the
            // self-loops of haveB, which nest upward.
            { name: 'back', x: 440, y: 330 },
            { name: 'haveB', x: 420, y: 560 },
            { name: 'matchB', x: 700, y: 560 },
            { name: 'yes', x: 970, y: 210, final: true }
        ],
        transitions: [
            { from: 'start', to: 'haveA', read: 'a', write: '□', move: 'R' },
            { from: 'start', to: 'haveB', read: 'b', write: '□', move: 'R' },
            { from: 'start', to: 'yes', read: '□', write: '□', move: 'R' },
            { from: 'haveA', to: 'haveA', read: 'a', write: 'a', move: 'R' },
            { from: 'haveA', to: 'haveA', read: 'b', write: 'b', move: 'R' },
            { from: 'haveA', to: 'matchA', read: '□', write: '□', move: 'L' },
            { from: 'matchA', to: 'back', read: 'a', write: '□', move: 'L' },
            { from: 'matchA', to: 'yes', read: '□', write: '□', move: 'R' },
            { from: 'haveB', to: 'haveB', read: 'a', write: 'a', move: 'R' },
            { from: 'haveB', to: 'haveB', read: 'b', write: 'b', move: 'R' },
            { from: 'haveB', to: 'matchB', read: '□', write: '□', move: 'L' },
            { from: 'matchB', to: 'back', read: 'b', write: '□', move: 'L' },
            { from: 'matchB', to: 'yes', read: '□', write: '□', move: 'R' },
            { from: 'back', to: 'back', read: 'a', write: 'a', move: 'L' },
            { from: 'back', to: 'back', read: 'b', write: 'b', move: 'L' },
            { from: 'back', to: 'start', read: '□', write: '□', move: 'R' }
        ],
        accept: ['ε', 'a', 'b', 'aa', 'bb', 'aba', 'bab', 'abba', 'aabaa', 'abaaba'],
        reject: ['ab', 'ba', 'aab', 'baa', 'abb', 'abab', 'aabb', 'abaab']
    },
    {
        id: 'unary-add',
        name: 'Unary Addition',
        type: 'tm',
        blurb: 'Adds two tally numbers: 111+11 leaves 11111 on the tape.',
        idea: `In unary, adding is just deleting the plus sign — the two runs of tallies become one. The machine overwrites + with a 1, which is one tally too many, then walks to the far end and erases the last one to compensate. The whole of arithmetic here is one substitution and one deletion, which is a good reminder of how little a Turing machine actually needs to compute something useful.`,
        alphabet: ['1', '+'],
        states: [
            { name: 'find', x: 200, y: 250, initial: true },
            { name: 'seek', x: 450, y: 250 },
            { name: 'erase', x: 700, y: 250 },
            { name: 'done', x: 950, y: 250, final: true }
        ],
        transitions: [
            { from: 'find', to: 'find', read: '1', write: '1', move: 'R' },
            { from: 'find', to: 'seek', read: '+', write: '1', move: 'R' },
            { from: 'seek', to: 'seek', read: '1', write: '1', move: 'R' },
            { from: 'seek', to: 'erase', read: '□', write: '□', move: 'L' },
            { from: 'erase', to: 'done', read: '1', write: '□', move: 'S' }
        ],
        accept: ['1+1', '111+11', '+1', '1+', '+', '11+111', '1111+1'],
        reject: ['ε', '1', '11', '111', '1++1', '+11+'],
        note: 'An input with no + is rejected: the machine runs off the end looking for one and halts with no rule to follow.'
    }
];

/**
 * Helpers for turning an example definition into a live automaton.
 */
const Examples = {
    categories: EXAMPLE_CATEGORIES,
    all: EXAMPLES,

    byId(id) {
        return EXAMPLES.find(e => e.id === id) || null;
    },

    /** 'ε' is how the example lists spell the empty string. */
    decodeString(value) {
        return (value === 'ε' || value === 'ϵ') ? '' : value;
    },

    encodeString(value) {
        return value === '' ? 'ε' : value;
    },

    testStrings(example) {
        return [
            ...example.accept.map(s => ({ input: this.decodeString(s), expected: true })),
            ...example.reject.map(s => ({ input: this.decodeString(s), expected: false }))
        ];
    },

    /** Build a fresh automaton instance from an example definition. */
    build(example) {
        let automaton;
        switch (example.type) {
            case 'nfa': automaton = new NFA(); break;
            case 'pda': automaton = new PDA(); break;
            case 'tm': automaton = new TuringMachine(); break;
            default: automaton = new DFA(); break;
        }

        State.resetIdCounter();
        Transition.resetIdCounter();

        const byName = new Map();
        const states = example.states.map(spec => {
            const state = new State({
                name: spec.name,
                x: spec.x,
                y: spec.y,
                isInitial: !!spec.initial,
                isFinal: !!spec.final
            });
            byName.set(spec.name, state);
            return state;
        });

        const transitions = example.transitions.map(spec => {
            const options = {
                fromState: byName.get(spec.from),
                toState: byName.get(spec.to)
            };

            if (example.type === 'tm') {
                options.readSymbol = spec.read;
                options.writeSymbol = spec.write;
                options.direction = spec.move;
            } else if (example.type === 'pda') {
                options.symbols = [spec.on || 'ε'];
                options.stackRead = spec.pop || 'ε';
                options.stackWrite = spec.push || 'ε';
            } else {
                options.symbols = String(spec.on).split(',')
                    .map(s => s.trim())
                    .filter(s => s !== '');
                if (options.symbols.length === 0) options.symbols = ['ε'];
            }

            return new Transition(options);
        });

        const json = {
            type: example.type,
            states: states.map(s => s.toJSON()),
            transitions: transitions.map(t => t.toJSON()),
            alphabet: example.alphabet.slice(),
            initialStateId: (states.find(s => s.isInitial) || states[0] || {}).id ?? null
        };

        if (example.type === 'pda') {
            json.initialStackSymbol = 'Z';
            json.acceptByFinalState = true;
            json.acceptByEmptyStack = false;
            json.stackAlphabet = ['Z', 'A', 'B', 'X'];
        }
        if (example.type === 'tm') {
            json.blankSymbol = '□';
            json.tapeAlphabet = ['□', ...example.alphabet];
        }

        automaton.loadFromJSON(json);
        return automaton;
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EXAMPLES, EXAMPLE_CATEGORIES, Examples };
}
