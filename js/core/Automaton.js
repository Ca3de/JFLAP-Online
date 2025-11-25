/**
 * Base Automaton class
 * This serves as the base class for DFA, NFA, PDA, and Turing Machine
 */
class Automaton {
    constructor(type = 'dfa') {
        this.type = type;
        this.states = [];
        this.transitions = [];
        this.alphabet = new Set();
        this.initialState = null;

        // Simulation state
        this.currentStates = new Set(); // For NFA, can be multiple
        this.input = '';
        this.inputIndex = 0;
        this.trace = [];
        this.isRunning = false;
        this.isAccepted = null;

        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
    }

    /**
     * Add a state to the automaton
     */
    addState(state) {
        // If this is the first state, make it initial by default
        if (this.states.length === 0) {
            state.isInitial = true;
            this.initialState = state;
        }

        // If this state is marked as initial, update initialState
        if (state.isInitial) {
            // Remove initial from any existing initial state
            if (this.initialState && this.initialState !== state) {
                this.initialState.isInitial = false;
            }
            this.initialState = state;
        }

        this.states.push(state);
        this.saveToHistory();
        return state;
    }

    /**
     * Remove a state and its associated transitions
     */
    removeState(state) {
        const stateId = typeof state === 'object' ? state.id : state;

        // Remove all transitions involving this state
        this.transitions = this.transitions.filter(t => {
            const fromId = t.getFromStateId();
            const toId = t.getToStateId();
            return fromId !== stateId && toId !== stateId;
        });

        // Remove the state
        this.states = this.states.filter(s => s.id !== stateId);

        // Update initial state if needed
        if (this.initialState && this.initialState.id === stateId) {
            this.initialState = this.states.length > 0 ? this.states[0] : null;
            if (this.initialState) {
                this.initialState.isInitial = true;
            }
        }

        this.saveToHistory();
    }

    /**
     * Add a transition
     */
    addTransition(transition) {
        // Update alphabet
        if (transition.symbols) {
            transition.symbols.forEach(s => {
                if (s && s !== 'ε') {
                    this.alphabet.add(s);
                }
            });
        }

        this.transitions.push(transition);
        this.saveToHistory();
        return transition;
    }

    /**
     * Remove a transition
     */
    removeTransition(transition) {
        const transitionId = typeof transition === 'object' ? transition.id : transition;
        this.transitions = this.transitions.filter(t => t.id !== transitionId);
        this.saveToHistory();
    }

    /**
     * Get state by ID
     */
    getState(id) {
        return this.states.find(s => s.id === id);
    }

    /**
     * Get transition by ID
     */
    getTransition(id) {
        return this.transitions.find(t => t.id === id);
    }

    /**
     * Get transitions from a state
     */
    getTransitionsFrom(state) {
        const stateId = typeof state === 'object' ? state.id : state;
        return this.transitions.filter(t => t.getFromStateId() === stateId);
    }

    /**
     * Get transitions to a state
     */
    getTransitionsTo(state) {
        const stateId = typeof state === 'object' ? state.id : state;
        return this.transitions.filter(t => t.getToStateId() === stateId);
    }

    /**
     * Get transitions between two states
     */
    getTransitionsBetween(fromState, toState) {
        const fromId = typeof fromState === 'object' ? fromState.id : fromState;
        const toId = typeof toState === 'object' ? toState.id : toState;
        return this.transitions.filter(t =>
            t.getFromStateId() === fromId && t.getToStateId() === toId
        );
    }

    /**
     * Set initial state
     */
    setInitialState(state) {
        // Remove initial from current initial state
        if (this.initialState) {
            this.initialState.isInitial = false;
        }

        const stateObj = typeof state === 'object' ? state : this.getState(state);
        if (stateObj) {
            stateObj.isInitial = true;
            this.initialState = stateObj;
        }
        this.saveToHistory();
    }

    /**
     * Get all final/accept states
     */
    getFinalStates() {
        return this.states.filter(s => s.isFinal);
    }

    /**
     * Clear all states and transitions
     */
    clear() {
        this.states = [];
        this.transitions = [];
        this.alphabet.clear();
        this.initialState = null;
        this.resetSimulation();
        State.resetIdCounter();
        Transition.resetIdCounter();
        this.saveToHistory();
    }

    /**
     * Reset simulation state
     */
    resetSimulation() {
        this.currentStates.clear();
        if (this.initialState) {
            this.currentStates.add(this.initialState);
        }
        this.inputIndex = 0;
        this.trace = [];
        this.isRunning = false;
        this.isAccepted = null;

        // Clear active state highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);
    }

    /**
     * Initialize simulation with input string
     */
    initSimulation(input) {
        this.input = input;
        this.resetSimulation();

        if (this.initialState) {
            this.currentStates.add(this.initialState);
            this.initialState.active = true;
            this.trace.push({
                step: 0,
                states: [this.initialState.name],
                remainingInput: input,
                symbol: null,
                description: `Start at state ${this.initialState.name}`
            });
        }

        return this.currentStates.size > 0;
    }

    /**
     * Perform one step of simulation
     * To be overridden by subclasses
     */
    step() {
        throw new Error('step() must be implemented by subclass');
    }

    /**
     * Run full simulation
     */
    run(maxSteps = 1000) {
        this.isRunning = true;
        let steps = 0;

        while (this.inputIndex < this.input.length && steps < maxSteps && this.currentStates.size > 0) {
            this.step();
            steps++;
        }

        this.isRunning = false;
        this.checkAcceptance();
        return this.isAccepted;
    }

    /**
     * Check if current configuration is accepting
     */
    checkAcceptance() {
        const finalStates = this.getFinalStates();
        for (const state of this.currentStates) {
            if (finalStates.some(f => f.id === state.id)) {
                this.isAccepted = true;
                return true;
            }
        }
        this.isAccepted = this.currentStates.size > 0 ? false : false;
        return this.isAccepted;
    }

    /**
     * Test if a string is accepted
     */
    accepts(input) {
        this.initSimulation(input);
        return this.run();
    }

    /**
     * Validate the automaton structure
     */
    validate() {
        const errors = [];

        if (!this.initialState) {
            errors.push('No initial state defined');
        }

        if (this.getFinalStates().length === 0) {
            errors.push('No final/accept states defined');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Save current state to history
     */
    saveToHistory() {
        const snapshot = this.toJSON();

        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(snapshot);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadFromJSON(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadFromJSON(this.history[this.historyIndex]);
            return true;
        }
        return false;
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            type: this.type,
            states: this.states.map(s => s.toJSON()),
            transitions: this.transitions.map(t => t.toJSON()),
            alphabet: Array.from(this.alphabet),
            initialStateId: this.initialState ? this.initialState.id : null
        };
    }

    /**
     * Load from JSON
     */
    loadFromJSON(json, clearHistory = false) {
        // Reset ID counters
        State.resetIdCounter();
        Transition.resetIdCounter();

        this.type = json.type || 'dfa';
        this.states = json.states.map(s => State.fromJSON(s));
        this.transitions = json.transitions.map(t => Transition.fromJSON(t, this.states));
        this.alphabet = new Set(json.alphabet || []);

        // Find and set initial state
        if (json.initialStateId !== null && json.initialStateId !== undefined) {
            this.initialState = this.getState(json.initialStateId);
        } else {
            this.initialState = this.states.find(s => s.isInitial) || null;
        }

        // Update ID counters to continue from max IDs
        if (this.states.length > 0) {
            const maxStateId = Math.max(...this.states.map(s => s.id));
            State.setIdCounter(maxStateId + 1);
        }
        if (this.transitions.length > 0) {
            const maxTransitionId = Math.max(...this.transitions.map(t => t.id));
            Transition.setIdCounter(maxTransitionId + 1);
        }

        this.resetSimulation();

        if (!clearHistory) {
            // Don't save to history when loading
        }
    }

    /**
     * Export to JFLAP XML format
     */
    toJFLAPXML() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<structure>\n';
        xml += `  <type>${this.type}</type>\n`;
        xml += '  <automaton>\n';

        // States
        this.states.forEach((state, index) => {
            xml += `    <state id="${state.id}" name="${state.name}">\n`;
            xml += `      <x>${state.x}</x>\n`;
            xml += `      <y>${state.y}</y>\n`;
            if (state.isInitial) xml += '      <initial/>\n';
            if (state.isFinal) xml += '      <final/>\n';
            xml += '    </state>\n';
        });

        // Transitions
        this.transitions.forEach(t => {
            xml += '    <transition>\n';
            xml += `      <from>${t.getFromStateId()}</from>\n`;
            xml += `      <to>${t.getToStateId()}</to>\n`;

            if (this.type === 'tm') {
                xml += `      <read>${t.readSymbol || ''}</read>\n`;
                xml += `      <write>${t.writeSymbol || ''}</write>\n`;
                xml += `      <move>${t.direction || 'R'}</move>\n`;
            } else if (this.type === 'pda') {
                xml += `      <read>${t.symbols[0] || ''}</read>\n`;
                xml += `      <pop>${t.stackRead || ''}</pop>\n`;
                xml += `      <push>${t.stackWrite || ''}</push>\n`;
            } else {
                t.symbols.forEach(symbol => {
                    xml += `      <read>${symbol === 'ε' ? '' : symbol}</read>\n`;
                });
            }

            xml += '    </transition>\n';
        });

        xml += '  </automaton>\n';
        xml += '</structure>';

        return xml;
    }

    /**
     * Create from JFLAP XML
     */
    static fromJFLAPXML(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');

        const typeElem = doc.querySelector('type');
        const type = typeElem ? typeElem.textContent : 'fa';

        let automaton;
        switch (type) {
            case 'turing':
            case 'tm':
                automaton = new TuringMachine();
                break;
            case 'pda':
                automaton = new PDA();
                break;
            case 'fa':
            default:
                // Determine if DFA or NFA based on transitions
                automaton = new NFA(); // Default to NFA, validate later
        }

        // Parse states
        const stateElems = doc.querySelectorAll('state');
        stateElems.forEach(elem => {
            const state = new State({
                id: parseInt(elem.getAttribute('id')),
                name: elem.getAttribute('name'),
                x: parseFloat(elem.querySelector('x')?.textContent || 100),
                y: parseFloat(elem.querySelector('y')?.textContent || 100),
                isInitial: elem.querySelector('initial') !== null,
                isFinal: elem.querySelector('final') !== null
            });
            automaton.states.push(state);
            if (state.isInitial) {
                automaton.initialState = state;
            }
        });

        // Update state ID counter
        if (automaton.states.length > 0) {
            State.setIdCounter(Math.max(...automaton.states.map(s => s.id)) + 1);
        }

        // Parse transitions
        const transElems = doc.querySelectorAll('transition');
        transElems.forEach(elem => {
            const fromId = parseInt(elem.querySelector('from').textContent);
            const toId = parseInt(elem.querySelector('to').textContent);
            const fromState = automaton.states.find(s => s.id === fromId);
            const toState = automaton.states.find(s => s.id === toId);

            const transition = new Transition({
                fromState: fromState,
                toState: toState
            });

            if (type === 'turing' || type === 'tm') {
                transition.readSymbol = elem.querySelector('read')?.textContent || '□';
                transition.writeSymbol = elem.querySelector('write')?.textContent || '□';
                transition.direction = elem.querySelector('move')?.textContent || 'R';
            } else if (type === 'pda') {
                const read = elem.querySelector('read')?.textContent || '';
                transition.symbols = [read || 'ε'];
                transition.stackRead = elem.querySelector('pop')?.textContent || 'ε';
                transition.stackWrite = elem.querySelector('push')?.textContent || 'ε';
            } else {
                const read = elem.querySelector('read')?.textContent || '';
                transition.symbols = [read || 'ε'];
            }

            automaton.transitions.push(transition);

            // Add to alphabet
            if (transition.symbols) {
                transition.symbols.forEach(s => {
                    if (s && s !== 'ε') automaton.alphabet.add(s);
                });
            }
        });

        return automaton;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Automaton;
}
