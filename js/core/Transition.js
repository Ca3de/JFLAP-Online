/**
 * Transition class representing a transition between states
 */
class Transition {
    static nextId = 0;

    constructor(options = {}) {
        this.id = options.id !== undefined ? options.id : Transition.nextId++;
        this.fromState = options.fromState; // State object or ID
        this.toState = options.toState;     // State object or ID
        this.symbols = options.symbols || []; // Array of symbols (for NFA, multiple symbols possible)

        // For PDA
        this.stackRead = options.stackRead || null;  // Symbol to pop from stack
        this.stackWrite = options.stackWrite || null; // Symbol(s) to push to stack

        // For Turing Machine
        this.readSymbol = options.readSymbol || null;
        this.writeSymbol = options.writeSymbol || null;
        this.direction = options.direction || null; // 'L', 'R', or 'S' (stay)

        // Visual properties
        this.selected = false;
        this.highlighted = false;
        this.color = options.color || '#94a3b8';

        // Control point for curved transitions
        this.controlPoint = options.controlPoint || null;

        // Label position offset
        this.labelOffset = options.labelOffset || { x: 0, y: -10 };
    }

    /**
     * Check if this transition accepts a given symbol
     */
    accepts(symbol) {
        // Handle epsilon transitions
        if (this.symbols.includes('ε') || this.symbols.includes('')) {
            return symbol === '' || symbol === 'ε' || symbol === null;
        }
        return this.symbols.includes(symbol);
    }

    /**
     * Check if this is an epsilon transition
     */
    isEpsilon() {
        return this.symbols.length === 0 ||
            this.symbols.includes('ε') ||
            (this.symbols.length === 1 && this.symbols[0] === '');
    }

    /**
     * Get the label for display
     */
    getLabel(machineType = 'dfa') {
        switch (machineType) {
            case 'dfa':
            case 'nfa':
                if (this.isEpsilon()) return 'ε';
                return this.symbols.join(', ');

            case 'pda':
                const input = this.symbols.length > 0 ? this.symbols[0] : 'ε';
                const pop = this.stackRead || 'ε';
                const push = this.stackWrite || 'ε';
                return `${input}, ${pop} → ${push}`;

            case 'tm':
                const read = this.readSymbol || '□';
                const write = this.writeSymbol || '□';
                const dir = this.direction || 'R';
                return `${read} → ${write}, ${dir}`;

            default:
                return this.symbols.join(', ');
        }
    }

    /**
     * Check if this is a self-loop
     */
    isSelfLoop() {
        if (typeof this.fromState === 'object' && typeof this.toState === 'object') {
            return this.fromState.id === this.toState.id;
        }
        return this.fromState === this.toState;
    }

    /**
     * Get the from state ID
     */
    getFromStateId() {
        return typeof this.fromState === 'object' ? this.fromState.id : this.fromState;
    }

    /**
     * Get the to state ID
     */
    getToStateId() {
        return typeof this.toState === 'object' ? this.toState.id : this.toState;
    }

    /**
     * Clone this transition
     */
    clone() {
        return new Transition({
            id: this.id,
            fromState: this.fromState,
            toState: this.toState,
            symbols: [...this.symbols],
            stackRead: this.stackRead,
            stackWrite: this.stackWrite,
            readSymbol: this.readSymbol,
            writeSymbol: this.writeSymbol,
            direction: this.direction,
            color: this.color,
            controlPoint: this.controlPoint ? { ...this.controlPoint } : null,
            labelOffset: { ...this.labelOffset }
        });
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            fromState: this.getFromStateId(),
            toState: this.getToStateId(),
            symbols: this.symbols,
            stackRead: this.stackRead,
            stackWrite: this.stackWrite,
            readSymbol: this.readSymbol,
            writeSymbol: this.writeSymbol,
            direction: this.direction,
            controlPoint: this.controlPoint,
            labelOffset: this.labelOffset
        };
    }

    /**
     * Create transition from JSON
     */
    static fromJSON(json, states) {
        const fromState = states.find(s => s.id === json.fromState);
        const toState = states.find(s => s.id === json.toState);

        return new Transition({
            id: json.id,
            fromState: fromState,
            toState: toState,
            symbols: json.symbols || [],
            stackRead: json.stackRead,
            stackWrite: json.stackWrite,
            readSymbol: json.readSymbol,
            writeSymbol: json.writeSymbol,
            direction: json.direction,
            controlPoint: json.controlPoint,
            labelOffset: json.labelOffset
        });
    }

    /**
     * Parse transition label based on machine type
     */
    static parseLabel(label, machineType) {
        switch (machineType) {
            case 'dfa':
                // Single symbol only
                return {
                    symbols: [label.trim() || 'ε']
                };

            case 'nfa':
                // Can have multiple symbols separated by comma
                const nfaSymbols = label.split(',').map(s => s.trim()).filter(s => s !== '');
                return {
                    symbols: nfaSymbols.length > 0 ? nfaSymbols : ['ε']
                };

            case 'pda':
                // Format: input,stackPop;stackPush or input,stackPop→stackPush
                const pdaMatch = label.match(/^([^,]*),([^;→]*)(?:[;→])(.*)$/);
                if (pdaMatch) {
                    return {
                        symbols: [pdaMatch[1].trim() || 'ε'],
                        stackRead: pdaMatch[2].trim() || 'ε',
                        stackWrite: pdaMatch[3].trim() || 'ε'
                    };
                }
                return { symbols: ['ε'], stackRead: 'ε', stackWrite: 'ε' };

            case 'tm':
                // Format: read;write,direction or read→write,direction
                const tmMatch = label.match(/^([^;→]*)(?:[;→])([^,]*),([LRS])$/i);
                if (tmMatch) {
                    return {
                        readSymbol: tmMatch[1].trim() || '□',
                        writeSymbol: tmMatch[2].trim() || '□',
                        direction: tmMatch[3].toUpperCase()
                    };
                }
                return { readSymbol: '□', writeSymbol: '□', direction: 'R' };

            default:
                return { symbols: [label] };
        }
    }

    /**
     * Reset the static ID counter
     */
    static resetIdCounter() {
        Transition.nextId = 0;
    }

    /**
     * Set the ID counter to continue from a specific value
     */
    static setIdCounter(value) {
        Transition.nextId = value;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Transition;
}
