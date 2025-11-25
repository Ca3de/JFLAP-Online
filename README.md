# JFLAP Online

A modern, web-based implementation of JFLAP (Java Formal Languages and Automata Package) for creating, visualizing, and simulating automata and formal language machines directly in your browser.

## Features

### Supported Machine Types

- **DFA** (Deterministic Finite Automaton) - Single transition per symbol, no epsilon transitions
- **NFA** (Non-deterministic Finite Automaton) - Multiple transitions per symbol, epsilon (ε) transitions supported
- **PDA** (Pushdown Automaton) - NFA with a stack for context-free language recognition
- **Turing Machine** - Unlimited tape with read/write head for computation

### Visual Editor

- **Interactive Canvas** - Click to create states, drag to move them
- **Transition Drawing** - Click and drag between states to create transitions
- **Real-time Rendering** - See your automaton update instantly
- **Selection Tools** - Select, move, and delete states and transitions
- **Context Menus** - Right-click for quick actions (toggle initial/final, delete)
- **Zoom & Pan** - Mouse wheel to zoom, middle-click to pan

### Simulation

- **Step-by-Step Execution** - Watch your automaton process input one symbol at a time
- **Full Run** - Execute complete simulation with adjustable speed
- **Execution Trace** - View the complete history of state transitions
- **Visual Highlighting** - Active states and transitions are highlighted during simulation
- **Multiple Configurations** - NFA/PDA simulations show all active configurations

### Turing Machine Features

- **Tape Visualization** - See the infinite tape with head position indicator
- **Read/Write/Move** - Full Turing machine transition support
- **Blank Symbol Support** - Uses □ as the blank symbol

### PDA Features

- **Stack Operations** - Push and pop operations on the stack
- **Stack Display** - Real-time stack visualization
- **Accept Modes** - Accept by final state or empty stack

### Code Integration

- **JSON Export/Import** - Save and load automata as JSON files
- **JFLAP Compatibility** - Import/Export .jff files (JFLAP format)
- **JavaScript Code Generation** - Get runnable JavaScript code for your automaton
- **Programmatic Control** - Full API for building automata in code

### Batch Testing

- Test multiple input strings at once
- See accept/reject results for each input

## Getting Started

### Running Locally

1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. No server required - runs entirely client-side!

### Quick Start

1. **Select Machine Type** - Choose DFA, NFA, PDA, or Turing Machine from the dropdown
2. **Create States** - Select the "State" tool and click on the canvas
3. **Create Transitions** - Select the "Transition" tool, click a state and drag to another
4. **Set Initial/Final States** - Double-click a state or right-click for options
5. **Test Your Automaton** - Enter an input string and click "Run" or "Step"

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| S | State tool |
| T | Transition tool |
| D | Delete tool |
| Delete/Backspace | Delete selected |
| Ctrl+S | Save |
| Ctrl+O | Load |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Space | Run/Pause simulation |
| Right Arrow | Step forward |
| Escape | Cancel current action |

## Transition Syntax

### DFA/NFA
- Single character: `a`, `b`, `0`, `1`
- Epsilon transition: `ε` or leave empty

### PDA
Format: `input,pop;push`
- Example: `a,Z;AZ` - Read 'a', pop 'Z', push 'AZ'
- Epsilon: `ε,ε;ε` - No input, no pop, no push

### Turing Machine
Format: `read;write,direction`
- Example: `0;1,R` - Read '0', write '1', move right
- Directions: `L` (left), `R` (right), `S` (stay)
- Blank symbol: `□`

## File Formats

### JSON Format
```json
{
  "type": "dfa",
  "states": [
    {"id": 0, "name": "q0", "x": 100, "y": 200, "isInitial": true, "isFinal": false},
    {"id": 1, "name": "q1", "x": 250, "y": 200, "isInitial": false, "isFinal": true}
  ],
  "transitions": [
    {"id": 0, "fromState": 0, "toState": 1, "symbols": ["a"]}
  ],
  "alphabet": ["a"]
}
```

### JFLAP XML Format (.jff)
Compatible with the desktop JFLAP application.

## API Usage

You can also use the automata classes programmatically:

```javascript
// Create a DFA
const dfa = new DFA();

// Add states
const q0 = new State({ name: 'q0', x: 100, y: 200, isInitial: true });
const q1 = new State({ name: 'q1', x: 250, y: 200, isFinal: true });
dfa.addState(q0);
dfa.addState(q1);

// Add transitions
dfa.addTransition(new Transition({
    fromState: q0,
    toState: q1,
    symbols: ['a']
}));

// Test input
dfa.initSimulation('a');
const accepted = dfa.run();
console.log(accepted); // true
```

## Browser Support

Works in all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

This project is open source and available for educational use.

## Acknowledgments

Inspired by the original [JFLAP](http://www.jflap.org/) by Susan Rodger and her students at Duke University.
