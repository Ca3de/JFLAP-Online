/**
 * CanvasRenderer - Handles drawing automata on canvas
 */
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Colors
        this.colors = {
            background: '#1e293b',
            grid: '#334155',
            state: '#3b82f6',
            stateStroke: '#60a5fa',
            stateText: '#ffffff',
            initialArrow: '#22c55e',
            finalRing: '#f59e0b',
            activeState: '#ec4899',
            selectedState: '#8b5cf6',
            transition: '#94a3b8',
            transitionText: '#e2e8f0',
            highlightedTransition: '#fbbf24',
            selectedTransition: '#a78bfa'
        };

        // State appearance
        this.stateRadius = 30;
        this.finalRingOffset = 5;
        this.initialArrowLength = 40;

        // Transition appearance
        this.arrowSize = 10;
        this.selfLoopRadius = 25;
        this.curveOffset = 30;

        this.setupCanvas();
    }

    /**
     * Setup canvas size
     */
    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resize canvas to container
     */
    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
    }

    /**
     * Draw background grid
     */
    drawGrid() {
        const gridSize = 20 * this.scale;
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;

        const startX = this.offsetX % gridSize;
        const startY = this.offsetY % gridSize;

        for (let x = startX; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = startY; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Transform coordinates to canvas space
     */
    toCanvasCoords(x, y) {
        return {
            x: (x + this.offsetX) * this.scale,
            y: (y + this.offsetY) * this.scale
        };
    }

    /**
     * Transform canvas coordinates to world space
     */
    toWorldCoords(x, y) {
        return {
            x: x / this.scale - this.offsetX,
            y: y / this.scale - this.offsetY
        };
    }

    /**
     * Draw the entire automaton
     */
    render(automaton) {
        this.clear();

        // Draw transitions first (so they appear behind states)
        automaton.transitions.forEach(t => {
            this.drawTransition(t, automaton);
        });

        // Draw states
        automaton.states.forEach(s => {
            this.drawState(s);
        });
    }

    /**
     * Draw a state
     */
    drawState(state) {
        const pos = this.toCanvasCoords(state.x, state.y);
        const radius = this.stateRadius * this.scale;

        // Determine fill color based on state
        let fillColor = this.colors.state;
        let strokeColor = this.colors.stateStroke;

        if (state.active) {
            fillColor = this.colors.activeState;
            strokeColor = '#f472b6';
        } else if (state.selected) {
            fillColor = this.colors.selectedState;
            strokeColor = '#a78bfa';
        }

        // Draw main circle
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.stroke();

        // Draw final state ring
        if (state.isFinal) {
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius - this.finalRingOffset * this.scale, 0, Math.PI * 2);
            this.ctx.strokeStyle = this.colors.finalRing;
            this.ctx.lineWidth = 2 * this.scale;
            this.ctx.stroke();
        }

        // Draw initial state arrow
        if (state.isInitial) {
            this.drawInitialArrow(pos.x, pos.y, radius);
        }

        // Draw state name
        this.ctx.fillStyle = this.colors.stateText;
        this.ctx.font = `${14 * this.scale}px 'Segoe UI', sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(state.name, pos.x, pos.y);
    }

    /**
     * Draw initial state arrow
     */
    drawInitialArrow(x, y, radius) {
        const arrowLength = this.initialArrowLength * this.scale;
        const startX = x - radius - arrowLength;
        const endX = x - radius;

        this.ctx.beginPath();
        this.ctx.moveTo(startX, y);
        this.ctx.lineTo(endX, y);
        this.ctx.strokeStyle = this.colors.initialArrow;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.stroke();

        // Arrow head
        this.drawArrowHead(endX, y, 0, this.colors.initialArrow);
    }

    /**
     * Draw arrow head
     */
    drawArrowHead(x, y, angle, color) {
        const size = this.arrowSize * this.scale;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-size, -size / 2);
        this.ctx.lineTo(-size, size / 2);
        this.ctx.closePath();

        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * Draw a transition
     */
    drawTransition(transition, automaton) {
        const fromState = typeof transition.fromState === 'object'
            ? transition.fromState
            : automaton.getState(transition.fromState);
        const toState = typeof transition.toState === 'object'
            ? transition.toState
            : automaton.getState(transition.toState);

        if (!fromState || !toState) return;

        // Determine color
        let color = this.colors.transition;
        if (transition.highlighted) {
            color = this.colors.highlightedTransition;
        } else if (transition.selected) {
            color = this.colors.selectedTransition;
        }

        const from = this.toCanvasCoords(fromState.x, fromState.y);
        const to = this.toCanvasCoords(toState.x, toState.y);
        const radius = this.stateRadius * this.scale;

        if (transition.isSelfLoop()) {
            this.drawSelfLoop(from, radius, transition, color, automaton);
        } else {
            // Check for parallel transitions
            const parallel = automaton.getTransitionsBetween(toState.id, fromState.id);
            const hasParallel = parallel.length > 0;

            this.drawArc(from, to, radius, transition, color, hasParallel, automaton);
        }
    }

    /**
     * Draw self-loop
     */
    drawSelfLoop(pos, radius, transition, color, automaton) {
        const loopRadius = this.selfLoopRadius * this.scale;
        const loopCenterY = pos.y - radius - loopRadius;

        // Draw loop arc
        this.ctx.beginPath();
        this.ctx.arc(pos.x, loopCenterY, loopRadius, 0.2 * Math.PI, 0.8 * Math.PI);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.stroke();

        // Arrow head on the right side
        const arrowX = pos.x + loopRadius * Math.cos(0.2 * Math.PI);
        const arrowY = loopCenterY + loopRadius * Math.sin(0.2 * Math.PI);
        this.drawArrowHead(arrowX, arrowY, -0.3 * Math.PI, color);

        // Label
        const label = transition.getLabel(automaton.type);
        this.ctx.fillStyle = this.colors.transitionText;
        this.ctx.font = `${12 * this.scale}px 'Segoe UI', sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(label, pos.x, loopCenterY - loopRadius - 5 * this.scale);
    }

    /**
     * Draw arc transition between two states
     */
    drawArc(from, to, radius, transition, color, curved, automaton) {
        // Calculate direction
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Calculate start and end points (on state circles)
        const startX = from.x + radius * Math.cos(angle);
        const startY = from.y + radius * Math.sin(angle);
        const endX = to.x - radius * Math.cos(angle);
        const endY = to.y - radius * Math.sin(angle);

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.scale;

        if (curved) {
            // Draw curved line
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Control point perpendicular to the line
            const perpX = -dy / dist * this.curveOffset * this.scale;
            const perpY = dx / dist * this.curveOffset * this.scale;

            const cpX = midX + perpX;
            const cpY = midY + perpY;

            this.ctx.moveTo(startX, startY);
            this.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
            this.ctx.stroke();

            // Arrow head
            const t = 0.9; // Position on curve for arrow direction
            const arrowAngle = Math.atan2(
                endY - (2 * (1 - t) * t * cpY + t * t * endY - (1 - t) * (1 - t) * startY - 2 * (1 - t) * t * cpY),
                endX - (2 * (1 - t) * t * cpX + t * t * endX - (1 - t) * (1 - t) * startX - 2 * (1 - t) * t * cpX)
            );
            this.drawArrowHead(endX, endY, angle, color);

            // Label
            const label = transition.getLabel(automaton.type);
            this.ctx.fillStyle = this.colors.transitionText;
            this.ctx.font = `${12 * this.scale}px 'Segoe UI', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = perpY < 0 ? 'top' : 'bottom';
            this.ctx.fillText(label, cpX, cpY + (perpY < 0 ? 5 : -5) * this.scale);
        } else {
            // Draw straight line
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();

            // Arrow head
            this.drawArrowHead(endX, endY, angle, color);

            // Label
            const label = transition.getLabel(automaton.type);
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Offset label perpendicular to line
            const perpDist = 15 * this.scale;
            const labelX = midX - (dy / dist) * perpDist;
            const labelY = midY + (dx / dist) * perpDist;

            this.ctx.fillStyle = this.colors.transitionText;
            this.ctx.font = `${12 * this.scale}px 'Segoe UI', sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            // Background for better readability
            const textWidth = this.ctx.measureText(label).width;
            this.ctx.fillStyle = this.colors.background;
            this.ctx.fillRect(labelX - textWidth / 2 - 4, labelY - 8 * this.scale, textWidth + 8, 16 * this.scale);

            this.ctx.fillStyle = this.colors.transitionText;
            this.ctx.fillText(label, labelX, labelY);
        }
    }

    /**
     * Draw selection box
     */
    drawSelectionBox(startX, startY, endX, endY) {
        const start = this.toCanvasCoords(startX, startY);
        const end = this.toCanvasCoords(endX, endY);

        this.ctx.strokeStyle = '#60a5fa';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            Math.min(start.x, end.x),
            Math.min(start.y, end.y),
            Math.abs(end.x - start.x),
            Math.abs(end.y - start.y)
        );
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
        this.ctx.fillRect(
            Math.min(start.x, end.x),
            Math.min(start.y, end.y),
            Math.abs(end.x - start.x),
            Math.abs(end.y - start.y)
        );
    }

    /**
     * Draw transition preview (when creating new transition)
     */
    drawTransitionPreview(fromState, toX, toY) {
        const from = this.toCanvasCoords(fromState.x, fromState.y);
        const to = this.toCanvasCoords(toX, toY);
        const radius = this.stateRadius * this.scale;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const angle = Math.atan2(dy, dx);

        const startX = from.x + radius * Math.cos(angle);
        const startY = from.y + radius * Math.sin(angle);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.strokeStyle = '#60a5fa';
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.drawArrowHead(to.x, to.y, angle, '#60a5fa');
    }

    /**
     * Set zoom level
     */
    setZoom(scale) {
        this.scale = Math.max(0.5, Math.min(2, scale));
    }

    /**
     * Pan the canvas
     */
    pan(dx, dy) {
        this.offsetX += dx / this.scale;
        this.offsetY += dy / this.scale;
    }

    /**
     * Reset view
     */
    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasRenderer;
}
