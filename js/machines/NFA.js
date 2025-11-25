/**
 * NFA - Non-deterministic Finite Automaton
 */
class NFA extends Automaton {
    constructor() {
        super('nfa');
    }

    /**
     * Compute epsilon closure of a set of states
     */
    epsilonClosure(states) {
        const closure = new Set();
        const stack = Array.isArray(states) ? [...states] : [states];

        // Add initial states to closure
        stack.forEach(s => {
            const state = typeof s === 'object' ? s : this.getState(s);
            if (state) closure.add(state);
        });

        while (stack.length > 0) {
            const current = stack.pop();
            const currentState = typeof current === 'object' ? current : this.getState(current);

            if (!currentState) continue;

            // Find epsilon transitions from current state
            const transitions = this.getTransitionsFrom(currentState);
            const epsilonTransitions = transitions.filter(t => t.isEpsilon());

            epsilonTransitions.forEach(t => {
                const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                if (toState && !closure.has(toState)) {
                    closure.add(toState);
                    stack.push(toState);
                }
            });
        }

        return closure;
    }

    /**
     * Initialize simulation - includes epsilon closure of initial state
     */
    initSimulation(input) {
        this.input = input;
        this.inputIndex = 0;
        this.trace = [];
        this.isRunning = false;
        this.isAccepted = null;

        // Clear active state highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        this.currentStates.clear();

        if (this.initialState) {
            // Start with epsilon closure of initial state
            const initialClosure = this.epsilonClosure([this.initialState]);
            initialClosure.forEach(s => {
                this.currentStates.add(s);
                s.active = true;
            });

            this.trace.push({
                step: 0,
                states: Array.from(this.currentStates).map(s => s.name),
                remainingInput: input,
                symbol: null,
                description: `Start at ε-closure({${this.initialState.name}}) = {${Array.from(this.currentStates).map(s => s.name).join(', ')}}`
            });
        }

        return this.currentStates.size > 0;
    }

    /**
     * Perform one step of NFA simulation
     */
    step() {
        if (this.inputIndex >= this.input.length || this.currentStates.size === 0) {
            this.isRunning = false;
            this.checkAcceptance();
            return false;
        }

        const symbol = this.input[this.inputIndex];

        // Clear previous highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        const nextStates = new Set();
        const usedTransitions = [];
        const fromStates = Array.from(this.currentStates).map(s => s.name);

        // For each current state, find all valid transitions
        this.currentStates.forEach(currentState => {
            const transitions = this.getTransitionsFrom(currentState);
            transitions.forEach(t => {
                if (t.accepts(symbol)) {
                    const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                    if (toState) {
                        nextStates.add(toState);
                        usedTransitions.push(t);
                    }
                }
            });
        });

        // Apply epsilon closure to next states
        const closedNextStates = new Set();
        nextStates.forEach(state => {
            const closure = this.epsilonClosure([state]);
            closure.forEach(s => closedNextStates.add(s));
        });

        // Update current states
        this.currentStates = closedNextStates;

        // Highlight active states and transitions
        this.currentStates.forEach(s => s.active = true);
        usedTransitions.forEach(t => t.highlighted = true);

        // Add to trace
        if (this.currentStates.size > 0) {
            this.trace.push({
                step: this.inputIndex + 1,
                states: Array.from(this.currentStates).map(s => s.name),
                remainingInput: this.input.substring(this.inputIndex + 1),
                symbol: symbol,
                description: `Read '${symbol}': {${fromStates.join(', ')}} → {${Array.from(this.currentStates).map(s => s.name).join(', ')}}`
            });
        } else {
            this.trace.push({
                step: this.inputIndex + 1,
                states: [],
                remainingInput: this.input.substring(this.inputIndex + 1),
                symbol: symbol,
                description: `Read '${symbol}': {${fromStates.join(', ')}} → {} (stuck)`
            });
        }

        this.inputIndex++;

        if (this.currentStates.size === 0) {
            this.isAccepted = false;
            this.isRunning = false;
            return false;
        }

        return true;
    }

    /**
     * Check acceptance - accepted if any current state is final
     */
    checkAcceptance() {
        if (this.inputIndex < this.input.length) {
            this.isAccepted = false;
            return false;
        }

        const finalStates = this.getFinalStates();
        for (const state of this.currentStates) {
            if (finalStates.some(f => f.id === state.id)) {
                this.isAccepted = true;
                return true;
            }
        }

        this.isAccepted = false;
        return false;
    }

    /**
     * Validate NFA
     */
    validate() {
        const baseValidation = super.validate();
        return {
            isValid: baseValidation.isValid,
            errors: baseValidation.errors,
            warnings: this.getWarnings()
        };
    }

    /**
     * Get warnings
     */
    getWarnings() {
        const warnings = [];

        // Check for unreachable states
        const reachable = this.getReachableStates();
        this.states.forEach(state => {
            if (!reachable.has(state.id) && !state.isInitial) {
                warnings.push(`State ${state.name} is unreachable`);
            }
        });

        return warnings;
    }

    /**
     * Get all states reachable from initial state (including via epsilon)
     */
    getReachableStates() {
        const reachable = new Set();
        const queue = [];

        if (this.initialState) {
            const initialClosure = this.epsilonClosure([this.initialState]);
            initialClosure.forEach(s => {
                queue.push(s);
                reachable.add(s.id);
            });
        }

        while (queue.length > 0) {
            const state = queue.shift();
            const transitions = this.getTransitionsFrom(state);

            transitions.forEach(t => {
                const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                if (toState && !reachable.has(toState.id)) {
                    // Add epsilon closure
                    const closure = this.epsilonClosure([toState]);
                    closure.forEach(s => {
                        if (!reachable.has(s.id)) {
                            reachable.add(s.id);
                            queue.push(s);
                        }
                    });
                }
            });
        }

        return reachable;
    }

    /**
     * Convert NFA to DFA using subset construction
     */
    toDFA() {
        const dfa = new DFA();
        const stateMap = new Map(); // Maps set of NFA state IDs to DFA state
        const queue = [];

        // Start with epsilon closure of initial state
        const initialClosure = this.epsilonClosure([this.initialState]);
        const initialIds = Array.from(initialClosure).map(s => s.id).sort().join(',');

        const initialDFAState = new State({
            name: `{${Array.from(initialClosure).map(s => s.name).join(',')}}`,
            x: 100,
            y: 200,
            isInitial: true,
            isFinal: Array.from(initialClosure).some(s => s.isFinal)
        });

        dfa.addState(initialDFAState);
        stateMap.set(initialIds, initialDFAState);
        queue.push({ nfaStates: initialClosure, dfaState: initialDFAState });

        let xOffset = 200;

        while (queue.length > 0) {
            const { nfaStates, dfaState } = queue.shift();

            // For each symbol in alphabet
            this.alphabet.forEach(symbol => {
                if (symbol === 'ε') return;

                // Find all states reachable via this symbol
                const nextStates = new Set();
                nfaStates.forEach(nfaState => {
                    const transitions = this.getTransitionsFrom(nfaState);
                    transitions.forEach(t => {
                        if (t.accepts(symbol)) {
                            const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                            if (toState) nextStates.add(toState);
                        }
                    });
                });

                if (nextStates.size === 0) return;

                // Apply epsilon closure
                const closedNext = new Set();
                nextStates.forEach(s => {
                    const closure = this.epsilonClosure([s]);
                    closure.forEach(c => closedNext.add(c));
                });

                const nextIds = Array.from(closedNext).map(s => s.id).sort().join(',');

                // Check if we've seen this state set before
                let nextDFAState = stateMap.get(nextIds);
                if (!nextDFAState) {
                    nextDFAState = new State({
                        name: `{${Array.from(closedNext).map(s => s.name).join(',')}}`,
                        x: xOffset,
                        y: 200 + (stateMap.size % 3) * 100,
                        isFinal: Array.from(closedNext).some(s => s.isFinal)
                    });
                    xOffset += 150;

                    dfa.addState(nextDFAState);
                    stateMap.set(nextIds, nextDFAState);
                    queue.push({ nfaStates: closedNext, dfaState: nextDFAState });
                }

                // Add transition
                dfa.addTransition(new Transition({
                    fromState: dfaState,
                    toState: nextDFAState,
                    symbols: [symbol]
                }));
            });
        }

        return dfa;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NFA;
}
