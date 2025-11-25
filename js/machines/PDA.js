/**
 * PDA - Pushdown Automaton
 */
class PDA extends Automaton {
    constructor() {
        super('pda');
        this.stack = [];
        this.stackAlphabet = new Set(['Z']); // Z is typically the initial stack symbol
        this.initialStackSymbol = 'Z';
        this.acceptByFinalState = true; // Can also accept by empty stack
        this.acceptByEmptyStack = false;

        // For NFA-style PDA, we track multiple configurations
        this.configurations = []; // Each config: { state, stack, inputIndex }
    }

    /**
     * Initialize simulation
     */
    initSimulation(input) {
        this.input = input;
        this.inputIndex = 0;
        this.trace = [];
        this.isRunning = false;
        this.isAccepted = null;

        // Clear highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        this.currentStates.clear();
        this.stack = [this.initialStackSymbol];
        this.configurations = [];

        if (this.initialState) {
            this.currentStates.add(this.initialState);
            this.initialState.active = true;

            // Initialize configuration
            this.configurations.push({
                state: this.initialState,
                stack: [this.initialStackSymbol],
                inputIndex: 0
            });

            this.trace.push({
                step: 0,
                states: [this.initialState.name],
                stack: this.stack.join(''),
                remainingInput: input,
                symbol: null,
                description: `Start at ${this.initialState.name}, stack: ${this.initialStackSymbol}`
            });
        }

        return this.currentStates.size > 0;
    }

    /**
     * Check if a transition can be taken given current stack top
     */
    canTakeTransition(transition, symbol, stackTop) {
        // Check input symbol
        const inputMatch = transition.symbols.length === 0 ||
            transition.isEpsilon() ||
            transition.symbols.includes(symbol);

        // Check stack
        const stackRead = transition.stackRead || 'ε';
        const stackMatch = stackRead === 'ε' || stackRead === stackTop;

        return inputMatch && stackMatch;
    }

    /**
     * Apply stack operation for a transition
     */
    applyStackOperation(stack, transition) {
        const newStack = [...stack];
        const stackRead = transition.stackRead || 'ε';
        const stackWrite = transition.stackWrite || 'ε';

        // Pop if needed
        if (stackRead !== 'ε' && newStack.length > 0) {
            newStack.pop();
        }

        // Push new symbols (in reverse order so first char is on top)
        if (stackWrite !== 'ε') {
            const symbols = stackWrite.split('').reverse();
            symbols.forEach(s => newStack.push(s));
        }

        return newStack;
    }

    /**
     * Perform one step of PDA simulation
     */
    step() {
        if (this.configurations.length === 0) {
            this.isRunning = false;
            this.checkAcceptance();
            return false;
        }

        // Clear highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        const newConfigurations = [];
        const stepDescriptions = [];

        // Process each current configuration
        this.configurations.forEach(config => {
            const { state, stack, inputIndex } = config;

            if (inputIndex > this.input.length) return;

            const symbol = inputIndex < this.input.length ? this.input[inputIndex] : null;
            const stackTop = stack.length > 0 ? stack[stack.length - 1] : 'ε';

            const transitions = this.getTransitionsFrom(state);

            transitions.forEach(t => {
                // Check epsilon transitions (don't consume input)
                if (t.isEpsilon() && this.canTakeTransition(t, null, stackTop)) {
                    const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                    if (toState) {
                        const newStack = this.applyStackOperation(stack, t);
                        newConfigurations.push({
                            state: toState,
                            stack: newStack,
                            inputIndex: inputIndex // Don't advance
                        });
                        stepDescriptions.push(`ε-move: ${state.name} → ${toState.name}, stack: ${newStack.join('') || 'ε'}`);
                        t.highlighted = true;
                    }
                }

                // Check symbol transitions
                if (symbol !== null && this.canTakeTransition(t, symbol, stackTop) && !t.isEpsilon()) {
                    const toState = typeof t.toState === 'object' ? t.toState : this.getState(t.toState);
                    if (toState) {
                        const newStack = this.applyStackOperation(stack, t);
                        newConfigurations.push({
                            state: toState,
                            stack: newStack,
                            inputIndex: inputIndex + 1
                        });
                        stepDescriptions.push(`Read '${symbol}': ${state.name} → ${toState.name}, stack: ${newStack.join('') || 'ε'}`);
                        t.highlighted = true;
                    }
                }
            });
        });

        // Update configurations
        this.configurations = newConfigurations;

        // Update current states for display
        this.currentStates.clear();
        this.configurations.forEach(config => {
            this.currentStates.add(config.state);
            config.state.active = true;
        });

        // Update main stack display (from first configuration)
        if (this.configurations.length > 0) {
            this.stack = [...this.configurations[0].stack];
            this.inputIndex = this.configurations[0].inputIndex;
        }

        // Add to trace
        if (stepDescriptions.length > 0) {
            this.trace.push({
                step: this.trace.length,
                states: Array.from(this.currentStates).map(s => s.name),
                stack: this.stack.join('') || 'ε',
                remainingInput: this.input.substring(this.inputIndex),
                symbol: null,
                description: stepDescriptions.join(' | ')
            });
        }

        if (this.configurations.length === 0) {
            this.isAccepted = false;
            this.isRunning = false;
            return false;
        }

        // Check if we're done (all input consumed)
        const allDone = this.configurations.every(c => c.inputIndex >= this.input.length);
        if (allDone) {
            this.checkAcceptance();
            if (this.isAccepted !== null) {
                return false;
            }
        }

        return true;
    }

    /**
     * Run simulation with step limit
     */
    run(maxSteps = 1000) {
        this.isRunning = true;
        let steps = 0;

        while (steps < maxSteps && this.configurations.length > 0) {
            const hadProgress = this.step();
            steps++;

            // Check acceptance
            if (this.isAccepted === true) break;

            // Check if stuck
            if (!hadProgress) break;
        }

        this.isRunning = false;
        if (this.isAccepted === null) {
            this.checkAcceptance();
        }
        return this.isAccepted;
    }

    /**
     * Check acceptance
     */
    checkAcceptance() {
        // Check if any configuration has consumed all input
        const finalConfigs = this.configurations.filter(c => c.inputIndex >= this.input.length);

        if (finalConfigs.length === 0) {
            this.isAccepted = false;
            return false;
        }

        // Check final state acceptance
        if (this.acceptByFinalState) {
            const finalStates = this.getFinalStates();
            for (const config of finalConfigs) {
                if (finalStates.some(f => f.id === config.state.id)) {
                    this.isAccepted = true;
                    return true;
                }
            }
        }

        // Check empty stack acceptance
        if (this.acceptByEmptyStack) {
            for (const config of finalConfigs) {
                if (config.stack.length === 0) {
                    this.isAccepted = true;
                    return true;
                }
            }
        }

        this.isAccepted = false;
        return false;
    }

    /**
     * Get current stack as string
     */
    getStackString() {
        return this.stack.length > 0 ? this.stack.join('') : 'ε';
    }

    /**
     * Validate PDA
     */
    validate() {
        const baseValidation = super.validate();
        return {
            isValid: baseValidation.isValid,
            errors: baseValidation.errors,
            warnings: []
        };
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        const json = super.toJSON();
        json.initialStackSymbol = this.initialStackSymbol;
        json.acceptByFinalState = this.acceptByFinalState;
        json.acceptByEmptyStack = this.acceptByEmptyStack;
        json.stackAlphabet = Array.from(this.stackAlphabet);
        return json;
    }

    /**
     * Load from JSON
     */
    loadFromJSON(json, clearHistory = false) {
        super.loadFromJSON(json, clearHistory);
        this.initialStackSymbol = json.initialStackSymbol || 'Z';
        this.acceptByFinalState = json.acceptByFinalState !== false;
        this.acceptByEmptyStack = json.acceptByEmptyStack || false;
        this.stackAlphabet = new Set(json.stackAlphabet || ['Z']);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDA;
}
