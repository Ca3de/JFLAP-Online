/**
 * DFA - Deterministic Finite Automaton
 */
class DFA extends Automaton {
    constructor() {
        super('dfa');
    }

    /**
     * Perform one step of DFA simulation
     */
    step() {
        if (this.inputIndex >= this.input.length || this.currentStates.size === 0) {
            this.isRunning = false;
            this.checkAcceptance();
            return false;
        }

        const symbol = this.input[this.inputIndex];
        const currentState = Array.from(this.currentStates)[0]; // DFA has only one current state

        // Clear previous highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        // Find transition for this symbol
        const transitions = this.getTransitionsFrom(currentState);
        const validTransition = transitions.find(t => t.accepts(symbol));

        if (validTransition) {
            const nextState = typeof validTransition.toState === 'object'
                ? validTransition.toState
                : this.getState(validTransition.toState);

            // Update state
            this.currentStates.clear();
            this.currentStates.add(nextState);

            // Highlight
            nextState.active = true;
            validTransition.highlighted = true;

            // Add to trace
            this.trace.push({
                step: this.inputIndex + 1,
                states: [nextState.name],
                remainingInput: this.input.substring(this.inputIndex + 1),
                symbol: symbol,
                description: `Read '${symbol}': ${currentState.name} → ${nextState.name}`
            });

            this.inputIndex++;
            return true;
        } else {
            // No valid transition - stuck/dead
            this.currentStates.clear();
            this.trace.push({
                step: this.inputIndex + 1,
                states: [],
                remainingInput: this.input.substring(this.inputIndex + 1),
                symbol: symbol,
                description: `Read '${symbol}': No transition from ${currentState.name} - REJECTED`
            });
            this.isAccepted = false;
            this.isRunning = false;
            return false;
        }
    }

    /**
     * Validate DFA specific rules
     */
    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];

        // Check for determinism: each state should have exactly one transition per symbol
        const alphabetArray = Array.from(this.alphabet);

        this.states.forEach(state => {
            const transitions = this.getTransitionsFrom(state);

            alphabetArray.forEach(symbol => {
                const symbolTransitions = transitions.filter(t => t.accepts(symbol));
                if (symbolTransitions.length > 1) {
                    errors.push(`State ${state.name} has multiple transitions for symbol '${symbol}'`);
                }
            });

            // Check for epsilon transitions (not allowed in DFA)
            const epsilonTransitions = transitions.filter(t => t.isEpsilon());
            if (epsilonTransitions.length > 0) {
                errors.push(`State ${state.name} has epsilon transition(s) - not allowed in DFA`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: this.getWarnings()
        };
    }

    /**
     * Get warnings (non-fatal issues)
     */
    getWarnings() {
        const warnings = [];
        const alphabetArray = Array.from(this.alphabet);

        // Check for missing transitions (incomplete DFA)
        this.states.forEach(state => {
            const transitions = this.getTransitionsFrom(state);
            alphabetArray.forEach(symbol => {
                const hasTransition = transitions.some(t => t.accepts(symbol));
                if (!hasTransition) {
                    warnings.push(`State ${state.name} is missing transition for symbol '${symbol}'`);
                }
            });
        });

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
     * Get all states reachable from initial state
     */
    getReachableStates() {
        const reachable = new Set();
        const queue = [];

        if (this.initialState) {
            queue.push(this.initialState);
            reachable.add(this.initialState.id);
        }

        while (queue.length > 0) {
            const state = queue.shift();
            const transitions = this.getTransitionsFrom(state);

            transitions.forEach(t => {
                const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                if (toState && !reachable.has(toState.id)) {
                    reachable.add(toState.id);
                    queue.push(toState);
                }
            });
        }

        return reachable;
    }

    /**
     * Minimize the DFA using partition refinement
     */
    minimize() {
        // Implementation of Hopcroft's algorithm would go here
        // For now, just return self
        console.log('DFA minimization not yet implemented');
        return this;
    }

    /**
     * Convert to NFA (trivial - DFA is already an NFA)
     */
    toNFA() {
        const nfa = new NFA();
        nfa.loadFromJSON(this.toJSON());
        nfa.type = 'nfa';
        return nfa;
    }

    /**
     * Generate regular expression (simplified)
     */
    toRegex() {
        // State elimination algorithm would go here
        console.log('Regular expression generation not yet implemented');
        return null;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFA;
}
