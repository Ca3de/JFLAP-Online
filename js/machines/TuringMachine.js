/**
 * TuringMachine - Single-tape Turing Machine
 */
class TuringMachine extends Automaton {
    constructor() {
        super('tm');
        this.tape = [];
        this.headPosition = 0;
        this.blankSymbol = '□';
        this.tapeAlphabet = new Set([this.blankSymbol]);

        // Display settings
        this.visibleTapeStart = -10;
        this.visibleTapeEnd = 10;
    }

    /**
     * Initialize the tape with input
     */
    initializeTape(input) {
        this.tape = [];

        // Add blank cells before input
        for (let i = this.visibleTapeStart; i < 0; i++) {
            this.tape.push(this.blankSymbol);
        }

        // Add input
        if (input && input.length > 0) {
            for (const char of input) {
                this.tape.push(char);
                this.tapeAlphabet.add(char);
            }
        }

        // Add blank cells after input
        for (let i = input.length; i <= this.visibleTapeEnd; i++) {
            this.tape.push(this.blankSymbol);
        }

        // Set head to first input position (or 0 if empty)
        this.headPosition = -this.visibleTapeStart; // Index in tape array for position 0
    }

    /**
     * Get tape cell at logical position
     */
    getTapeCell(position) {
        const index = position - this.visibleTapeStart;
        if (index < 0 || index >= this.tape.length) {
            return this.blankSymbol;
        }
        return this.tape[index];
    }

    /**
     * Set tape cell at logical position
     */
    setTapeCell(position, symbol) {
        const index = position - this.visibleTapeStart;

        // Extend tape if needed
        while (index < 0) {
            this.tape.unshift(this.blankSymbol);
            this.visibleTapeStart--;
            this.headPosition++; // Adjust head position
        }
        while (index >= this.tape.length) {
            this.tape.push(this.blankSymbol);
            this.visibleTapeEnd++;
        }

        this.tape[index] = symbol;
        this.tapeAlphabet.add(symbol);
    }

    /**
     * Get current symbol under head
     */
    getCurrentSymbol() {
        return this.getTapeCell(this.headPosition + this.visibleTapeStart);
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

        // Initialize tape
        this.visibleTapeStart = -10;
        this.visibleTapeEnd = Math.max(10, input.length + 10);
        this.initializeTape(input);

        if (this.initialState) {
            this.currentStates.add(this.initialState);
            this.initialState.active = true;

            this.trace.push({
                step: 0,
                states: [this.initialState.name],
                tape: this.getTapeString(),
                headPosition: 0,
                symbol: this.getCurrentSymbol(),
                description: `Start at ${this.initialState.name}, reading '${this.getCurrentSymbol()}'`
            });
        }

        return this.currentStates.size > 0;
    }

    /**
     * Get tape as string for display
     */
    getTapeString() {
        return this.tape.join('');
    }

    /**
     * Get tape as array of cells with positions
     */
    getTapeCells() {
        return this.tape.map((symbol, index) => ({
            position: index + this.visibleTapeStart,
            symbol: symbol,
            isHead: (index + this.visibleTapeStart) === 0 ?
                    index === this.headPosition - this.visibleTapeStart + this.visibleTapeStart :
                    index === this.headPosition
        }));
    }

    /**
     * Perform one step of TM simulation
     */
    step() {
        if (this.currentStates.size === 0) {
            this.isRunning = false;
            this.checkAcceptance();
            return false;
        }

        const currentState = Array.from(this.currentStates)[0];

        // Check for halt state
        if (currentState.isHalt || currentState.isFinal) {
            this.isRunning = false;
            this.checkAcceptance();
            return false;
        }

        // Clear highlighting
        this.states.forEach(s => s.active = false);
        this.transitions.forEach(t => t.highlighted = false);

        const currentSymbol = this.tape[this.headPosition];
        const transitions = this.getTransitionsFrom(currentState);

        // Find matching transition
        const validTransition = transitions.find(t => {
            const readSym = t.readSymbol || this.blankSymbol;
            return readSym === currentSymbol ||
                   (readSym === '□' && currentSymbol === this.blankSymbol) ||
                   (readSym === '_' && currentSymbol === this.blankSymbol) ||
                   (readSym === '' && currentSymbol === this.blankSymbol);
        });

        if (validTransition) {
            const nextState = typeof validTransition.toState === 'object'
                ? validTransition.toState
                : this.getState(validTransition.toState);

            if (!nextState) {
                this.isAccepted = false;
                this.isRunning = false;
                return false;
            }

            // Write symbol
            const writeSymbol = validTransition.writeSymbol || currentSymbol;
            const actualWrite = (writeSymbol === '□' || writeSymbol === '_' || writeSymbol === '')
                ? this.blankSymbol
                : writeSymbol;
            this.tape[this.headPosition] = actualWrite;

            // Move head
            const direction = (validTransition.direction || 'R').toUpperCase();
            const oldPosition = this.headPosition;

            if (direction === 'L') {
                this.headPosition--;
                // Extend tape left if needed
                if (this.headPosition < 0) {
                    this.tape.unshift(this.blankSymbol);
                    this.headPosition = 0;
                    this.visibleTapeStart--;
                }
            } else if (direction === 'R') {
                this.headPosition++;
                // Extend tape right if needed
                if (this.headPosition >= this.tape.length) {
                    this.tape.push(this.blankSymbol);
                    this.visibleTapeEnd++;
                }
            }
            // 'S' means stay

            // Update state
            this.currentStates.clear();
            this.currentStates.add(nextState);
            nextState.active = true;
            validTransition.highlighted = true;

            // Get logical head position
            const logicalHeadPos = this.headPosition + this.visibleTapeStart;

            this.trace.push({
                step: this.trace.length,
                states: [nextState.name],
                tape: this.getTapeString(),
                headPosition: logicalHeadPos,
                symbol: this.tape[this.headPosition],
                description: `Read '${currentSymbol}', write '${actualWrite}', move ${direction}: ${currentState.name} → ${nextState.name}`
            });

            this.inputIndex++;

            // Check if we've reached a halt/accept state
            if (nextState.isHalt || nextState.isFinal) {
                this.checkAcceptance();
                return false;
            }

            return true;
        } else {
            // No valid transition - halt (reject)
            this.trace.push({
                step: this.trace.length,
                states: [currentState.name],
                tape: this.getTapeString(),
                headPosition: this.headPosition + this.visibleTapeStart,
                symbol: currentSymbol,
                description: `No transition for '${currentSymbol}' from ${currentState.name} - HALT`
            });

            this.isAccepted = false;
            this.isRunning = false;
            return false;
        }
    }

    /**
     * Run simulation with step limit
     */
    run(maxSteps = 10000) {
        this.isRunning = true;
        let steps = 0;

        while (steps < maxSteps) {
            const continued = this.step();
            steps++;

            if (!continued) break;

            // Detect potential infinite loop (same configuration repeated)
            if (this.trace.length > 100) {
                const current = this.trace[this.trace.length - 1];
                const recent = this.trace.slice(-50);
                const duplicates = recent.filter(t =>
                    t.states[0] === current.states[0] &&
                    t.headPosition === current.headPosition &&
                    t.tape === current.tape
                );
                if (duplicates.length > 2) {
                    this.trace.push({
                        step: this.trace.length,
                        states: current.states,
                        tape: current.tape,
                        headPosition: current.headPosition,
                        symbol: current.symbol,
                        description: 'Potential infinite loop detected - halting'
                    });
                    break;
                }
            }
        }

        this.isRunning = false;
        if (this.isAccepted === null) {
            this.checkAcceptance();
        }
        return this.isAccepted;
    }

    /**
     * Check acceptance - TM accepts if it halts in a final state
     */
    checkAcceptance() {
        if (this.currentStates.size === 0) {
            this.isAccepted = false;
            return false;
        }

        const currentState = Array.from(this.currentStates)[0];

        if (currentState.isFinal || currentState.isHalt) {
            this.isAccepted = currentState.isFinal;
            return this.isAccepted;
        }

        // If we stopped without reaching final state, check if it's because no transition
        // In that case, reject
        this.isAccepted = false;
        return false;
    }

    /**
     * Validate Turing Machine
     */
    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];

        // TM doesn't strictly require final states (can just halt)
        // Remove the final state requirement error if present
        const finalStateErrorIndex = errors.findIndex(e => e.includes('final'));
        if (finalStateErrorIndex !== -1) {
            errors.splice(finalStateErrorIndex, 1);
        }

        return {
            isValid: errors.length === 0 || (errors.length === 0 && this.states.length > 0),
            errors: errors,
            warnings: this.getWarnings()
        };
    }

    /**
     * Get warnings
     */
    getWarnings() {
        const warnings = [];

        // Check for states with no outgoing transitions (potential infinite loops)
        this.states.forEach(state => {
            if (!state.isFinal && !state.isHalt) {
                const transitions = this.getTransitionsFrom(state);
                if (transitions.length === 0) {
                    warnings.push(`State ${state.name} has no outgoing transitions`);
                }
            }
        });

        return warnings;
    }

    /**
     * Get tape for display
     */
    getDisplayTape(windowSize = 21) {
        const half = Math.floor(windowSize / 2);
        const start = Math.max(0, this.headPosition - half);
        const end = Math.min(this.tape.length, this.headPosition + half + 1);

        const cells = [];
        for (let i = start; i < end; i++) {
            cells.push({
                index: i,
                position: i + this.visibleTapeStart,
                symbol: this.tape[i],
                isHead: i === this.headPosition
            });
        }

        // Pad with blanks if needed
        while (cells.length < windowSize) {
            if (cells[0] && cells[0].index > 0) {
                cells.unshift({
                    index: cells[0].index - 1,
                    position: cells[0].position - 1,
                    symbol: this.blankSymbol,
                    isHead: false
                });
            } else {
                cells.push({
                    index: cells.length > 0 ? cells[cells.length - 1].index + 1 : 0,
                    position: cells.length > 0 ? cells[cells.length - 1].position + 1 : 0,
                    symbol: this.blankSymbol,
                    isHead: false
                });
            }
        }

        return cells;
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        const json = super.toJSON();
        json.blankSymbol = this.blankSymbol;
        json.tapeAlphabet = Array.from(this.tapeAlphabet);
        return json;
    }

    /**
     * Load from JSON
     */
    loadFromJSON(json, clearHistory = false) {
        super.loadFromJSON(json, clearHistory);
        this.blankSymbol = json.blankSymbol || '□';
        this.tapeAlphabet = new Set(json.tapeAlphabet || [this.blankSymbol]);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TuringMachine;
}
