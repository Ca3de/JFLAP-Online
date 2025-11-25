/**
 * State class representing a state in an automaton
 */
class State {
    static nextId = 0;

    constructor(options = {}) {
        this.id = options.id !== undefined ? options.id : State.nextId++;
        this.name = options.name || `q${this.id}`;
        this.x = options.x || 100;
        this.y = options.y || 100;
        this.isInitial = options.isInitial || false;
        this.isFinal = options.isFinal || false;
        this.radius = options.radius || 30;

        // Visual properties
        this.color = options.color || '#3b82f6';
        this.selected = false;
        this.highlighted = false;
        this.active = false;

        // For Turing Machine
        this.isHalt = options.isHalt || false;
    }

    /**
     * Check if a point is inside this state
     */
    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) <= this.radius;
    }

    /**
     * Get distance to a point
     */
    distanceTo(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Move state to new position
     */
    moveTo(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Clone this state
     */
    clone() {
        return new State({
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            isInitial: this.isInitial,
            isFinal: this.isFinal,
            radius: this.radius,
            color: this.color,
            isHalt: this.isHalt
        });
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            isInitial: this.isInitial,
            isFinal: this.isFinal,
            isHalt: this.isHalt
        };
    }

    /**
     * Create state from JSON
     */
    static fromJSON(json) {
        return new State({
            id: json.id,
            name: json.name,
            x: json.x,
            y: json.y,
            isInitial: json.isInitial,
            isFinal: json.isFinal,
            isHalt: json.isHalt
        });
    }

    /**
     * Reset the static ID counter
     */
    static resetIdCounter() {
        State.nextId = 0;
    }

    /**
     * Set the ID counter to continue from a specific value
     */
    static setIdCounter(value) {
        State.nextId = value;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
}
