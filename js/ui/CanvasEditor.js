/**
 * CanvasEditor - Handles user interaction with the canvas
 */
class CanvasEditor {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.automaton = null;

        // Current tool
        this.currentTool = 'select'; // 'select', 'state', 'transition', 'delete'

        // Interaction state
        this.isDragging = false;
        this.isPanning = false;
        this.isDrawingTransition = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };

        // Selection
        this.selectedState = null;
        this.selectedTransition = null;
        this.hoveredState = null;
        this.transitionStartState = null;

        // Selection box
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectedStates = new Set();

        // Callbacks
        this.onStateSelected = null;
        this.onTransitionSelected = null;
        this.onStateCreated = null;
        this.onTransitionCreated = null;
        this.onStateDeleted = null;
        this.onTransitionDeleted = null;
        this.onAutomatonChanged = null;
        this.onRequestTransitionInput = null;

        this.setupEventListeners();
    }

    /**
     * Set the automaton to edit
     */
    setAutomaton(automaton) {
        this.automaton = automaton;
        this.clearSelection();
        this.render();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    /**
     * Get mouse position in world coordinates
     */
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        return this.renderer.toWorldCoords(canvasX, canvasY);
    }

    /**
     * Get state at position
     */
    getStateAt(x, y) {
        if (!this.automaton) return null;

        for (let i = this.automaton.states.length - 1; i >= 0; i--) {
            const state = this.automaton.states[i];
            if (state.containsPoint(x, y)) {
                return state;
            }
        }
        return null;
    }

    /**
     * Get transition at position
     */
    getTransitionAt(x, y) {
        if (!this.automaton) return null;

        for (const transition of this.automaton.transitions) {
            if (this.isPointNearTransition(x, y, transition)) {
                return transition;
            }
        }
        return null;
    }

    /**
     * Check if point is near a transition line
     */
    isPointNearTransition(x, y, transition) {
        const fromState = typeof transition.fromState === 'object'
            ? transition.fromState
            : this.automaton.getState(transition.fromState);
        const toState = typeof transition.toState === 'object'
            ? transition.toState
            : this.automaton.getState(transition.toState);

        if (!fromState || !toState) return false;

        const threshold = 10;

        if (transition.isSelfLoop()) {
            // Check distance to self-loop arc
            const loopCenterY = fromState.y - 30 - 25;
            const dist = Math.sqrt((x - fromState.x) ** 2 + (y - loopCenterY) ** 2);
            return Math.abs(dist - 25) < threshold;
        }

        // Check distance to line segment
        const dx = toState.x - fromState.x;
        const dy = toState.y - fromState.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) return fromState.distanceTo(x, y) < threshold;

        const t = Math.max(0, Math.min(1, ((x - fromState.x) * dx + (y - fromState.y) * dy) / lengthSq));
        const nearestX = fromState.x + t * dx;
        const nearestY = fromState.y + t * dy;
        const dist = Math.sqrt((x - nearestX) ** 2 + (y - nearestY) ** 2);

        return dist < threshold;
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.dragStart = { ...pos };
        this.lastMouse = { x: e.clientX, y: e.clientY };

        // Middle mouse button for panning
        if (e.button === 1) {
            this.isPanning = true;
            e.preventDefault();
            return;
        }

        // Right click handled by context menu
        if (e.button === 2) return;

        const state = this.getStateAt(pos.x, pos.y);
        const transition = this.getTransitionAt(pos.x, pos.y);

        switch (this.currentTool) {
            case 'select':
                if (state) {
                    this.selectState(state);
                    this.isDragging = true;
                } else if (transition) {
                    this.selectTransition(transition);
                } else {
                    this.clearSelection();
                    this.isSelecting = true;
                    this.selectionStart = { ...pos };
                }
                break;

            case 'state':
                if (!state) {
                    this.createState(pos.x, pos.y);
                }
                break;

            case 'transition':
                if (state) {
                    this.transitionStartState = state;
                    this.isDrawingTransition = true;
                }
                break;

            case 'delete':
                if (state) {
                    this.deleteState(state);
                } else if (transition) {
                    this.deleteTransition(transition);
                }
                break;
        }

        this.render();
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        const pos = this.getMousePos(e);

        // Update cursor based on what's under it
        if (this.currentTool === 'select' || this.currentTool === 'delete') {
            const state = this.getStateAt(pos.x, pos.y);
            const transition = this.getTransitionAt(pos.x, pos.y);

            if (state) {
                this.canvas.style.cursor = this.currentTool === 'delete' ? 'not-allowed' : 'move';
                this.hoveredState = state;
            } else if (transition) {
                this.canvas.style.cursor = 'pointer';
                this.hoveredState = null;
            } else {
                this.canvas.style.cursor = this.currentTool === 'state' ? 'crosshair' : 'default';
                this.hoveredState = null;
            }
        }

        // Handle panning
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.renderer.pan(dx, dy);
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        // Handle dragging state
        if (this.isDragging && this.selectedState) {
            this.selectedState.moveTo(pos.x, pos.y);
            this.notifyChange();
            this.render();
            return;
        }

        // Handle drawing transition
        if (this.isDrawingTransition && this.transitionStartState) {
            this.render();
            this.renderer.drawTransitionPreview(this.transitionStartState, pos.x, pos.y);
            return;
        }

        // Handle selection box
        if (this.isSelecting) {
            this.render();
            this.renderer.drawSelectionBox(
                this.selectionStart.x, this.selectionStart.y,
                pos.x, pos.y
            );
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        const pos = this.getMousePos(e);

        if (this.isPanning) {
            this.isPanning = false;
            return;
        }

        // Complete transition drawing
        if (this.isDrawingTransition && this.transitionStartState) {
            const targetState = this.getStateAt(pos.x, pos.y);
            if (targetState) {
                this.requestTransitionInput(this.transitionStartState, targetState);
            }
            this.transitionStartState = null;
            this.isDrawingTransition = false;
        }

        // Complete selection box
        if (this.isSelecting) {
            this.selectStatesInBox(
                this.selectionStart.x, this.selectionStart.y,
                pos.x, pos.y
            );
            this.isSelecting = false;
        }

        this.isDragging = false;
        this.render();
    }

    /**
     * Double click handler
     */
    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const state = this.getStateAt(pos.x, pos.y);
        const transition = this.getTransitionAt(pos.x, pos.y);

        if (state) {
            this.openStateProperties(state);
        } else if (transition) {
            this.openTransitionProperties(transition);
        } else if (this.currentTool !== 'delete') {
            // Create new state on double click
            this.createState(pos.x, pos.y);
        }
    }

    /**
     * Context menu handler
     */
    onContextMenu(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const state = this.getStateAt(pos.x, pos.y);
        const transition = this.getTransitionAt(pos.x, pos.y);

        if (state) {
            this.showStateContextMenu(e.clientX, e.clientY, state);
        } else if (transition) {
            this.showTransitionContextMenu(e.clientX, e.clientY, transition);
        }
    }

    /**
     * Wheel handler for zoom
     */
    onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.renderer.setZoom(this.renderer.scale * delta);
        this.render();
    }

    /**
     * Key down handler
     */
    onKeyDown(e) {
        // Ignore if typing in input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 'v':
                this.setTool('select');
                break;
            case 's':
                if (!e.ctrlKey) this.setTool('state');
                break;
            case 't':
                this.setTool('transition');
                break;
            case 'd':
                this.setTool('delete');
                break;
            case 'delete':
            case 'backspace':
                if (this.selectedState) {
                    this.deleteState(this.selectedState);
                } else if (this.selectedTransition) {
                    this.deleteTransition(this.selectedTransition);
                }
                break;
            case 'escape':
                this.clearSelection();
                this.isDrawingTransition = false;
                this.transitionStartState = null;
                this.render();
                break;
            case 'z':
                if (e.ctrlKey) {
                    this.automaton.undo();
                    this.render();
                }
                break;
            case 'y':
                if (e.ctrlKey) {
                    this.automaton.redo();
                    this.render();
                }
                break;
        }
    }

    /**
     * Set current tool
     */
    setTool(tool) {
        this.currentTool = tool;

        // Update cursor
        switch (tool) {
            case 'state':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'transition':
                this.canvas.style.cursor = 'cell';
                break;
            case 'delete':
                this.canvas.style.cursor = 'not-allowed';
                break;
            default:
                this.canvas.style.cursor = 'default';
        }

        // Update toolbar buttons
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tool-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    /**
     * Create a new state
     */
    createState(x, y) {
        if (!this.automaton) return;

        const state = new State({
            x: x,
            y: y,
            isInitial: this.automaton.states.length === 0
        });

        this.automaton.addState(state);
        this.selectState(state);
        this.notifyChange();

        if (this.onStateCreated) {
            this.onStateCreated(state);
        }

        this.render();
    }

    /**
     * Request transition input from user
     */
    requestTransitionInput(fromState, toState) {
        if (this.onRequestTransitionInput) {
            this.onRequestTransitionInput(fromState, toState);
        } else {
            // Default behavior - use prompt
            const label = prompt('Enter transition symbol(s):', '');
            if (label !== null) {
                this.createTransition(fromState, toState, label);
            }
        }
    }

    /**
     * Create a new transition
     */
    createTransition(fromState, toState, labelInput) {
        if (!this.automaton) return;

        const parsed = Transition.parseLabel(labelInput, this.automaton.type);
        const transition = new Transition({
            fromState: fromState,
            toState: toState,
            ...parsed
        });

        this.automaton.addTransition(transition);
        this.selectTransition(transition);
        this.notifyChange();

        if (this.onTransitionCreated) {
            this.onTransitionCreated(transition);
        }

        this.render();
    }

    /**
     * Delete a state
     */
    deleteState(state) {
        if (!this.automaton) return;

        this.automaton.removeState(state);
        this.clearSelection();
        this.notifyChange();

        if (this.onStateDeleted) {
            this.onStateDeleted(state);
        }

        this.render();
    }

    /**
     * Delete a transition
     */
    deleteTransition(transition) {
        if (!this.automaton) return;

        this.automaton.removeTransition(transition);
        this.clearSelection();
        this.notifyChange();

        if (this.onTransitionDeleted) {
            this.onTransitionDeleted(transition);
        }

        this.render();
    }

    /**
     * Select a state
     */
    selectState(state) {
        this.clearSelection();
        state.selected = true;
        this.selectedState = state;

        if (this.onStateSelected) {
            this.onStateSelected(state);
        }
    }

    /**
     * Select a transition
     */
    selectTransition(transition) {
        this.clearSelection();
        transition.selected = true;
        this.selectedTransition = transition;

        if (this.onTransitionSelected) {
            this.onTransitionSelected(transition);
        }
    }

    /**
     * Clear selection
     */
    clearSelection() {
        if (this.automaton) {
            this.automaton.states.forEach(s => s.selected = false);
            this.automaton.transitions.forEach(t => t.selected = false);
        }
        this.selectedState = null;
        this.selectedTransition = null;
        this.selectedStates.clear();
    }

    /**
     * Select states in box
     */
    selectStatesInBox(x1, y1, x2, y2) {
        if (!this.automaton) return;

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        this.clearSelection();

        this.automaton.states.forEach(state => {
            if (state.x >= minX && state.x <= maxX && state.y >= minY && state.y <= maxY) {
                state.selected = true;
                this.selectedStates.add(state);
            }
        });

        // If only one state selected, set it as selectedState
        if (this.selectedStates.size === 1) {
            this.selectedState = Array.from(this.selectedStates)[0];
            if (this.onStateSelected) {
                this.onStateSelected(this.selectedState);
            }
        }
    }

    /**
     * Open state properties dialog
     */
    openStateProperties(state) {
        // Emit event for main app to handle
        const event = new CustomEvent('openStateProperties', { detail: { state } });
        document.dispatchEvent(event);
    }

    /**
     * Open transition properties dialog
     */
    openTransitionProperties(transition) {
        // Emit event for main app to handle
        const event = new CustomEvent('openTransitionProperties', { detail: { transition } });
        document.dispatchEvent(event);
    }

    /**
     * Show state context menu
     */
    showStateContextMenu(x, y, state) {
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const items = [
            { label: 'Edit Properties', action: () => this.openStateProperties(state) },
            { label: state.isInitial ? 'Remove Initial' : 'Make Initial', action: () => this.toggleInitial(state) },
            { label: state.isFinal ? 'Remove Final' : 'Make Final', action: () => this.toggleFinal(state) },
            { divider: true },
            { label: 'Delete', action: () => this.deleteState(state) }
        ];

        items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                menu.appendChild(divider);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.label;
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.removeContextMenu();
                });
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);

        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', () => this.removeContextMenu(), { once: true });
        }, 0);
    }

    /**
     * Show transition context menu
     */
    showTransitionContextMenu(x, y, transition) {
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        const items = [
            { label: 'Edit Transition', action: () => this.openTransitionProperties(transition) },
            { divider: true },
            { label: 'Delete', action: () => this.deleteTransition(transition) }
        ];

        items.forEach(item => {
            if (item.divider) {
                const divider = document.createElement('div');
                divider.className = 'context-menu-divider';
                menu.appendChild(divider);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.label;
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.removeContextMenu();
                });
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);

        setTimeout(() => {
            document.addEventListener('click', () => this.removeContextMenu(), { once: true });
        }, 0);
    }

    /**
     * Remove context menu
     */
    removeContextMenu() {
        const existing = document.querySelector('.context-menu');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Toggle initial state
     */
    toggleInitial(state) {
        if (state.isInitial) {
            state.isInitial = false;
            this.automaton.initialState = null;
        } else {
            this.automaton.setInitialState(state);
        }
        this.notifyChange();
        this.render();
    }

    /**
     * Toggle final state
     */
    toggleFinal(state) {
        state.isFinal = !state.isFinal;
        this.notifyChange();
        this.render();
    }

    /**
     * Render the canvas
     */
    render() {
        if (this.automaton) {
            this.renderer.render(this.automaton);
        } else {
            this.renderer.clear();
        }
    }

    /**
     * Notify of automaton change
     */
    notifyChange() {
        if (this.onAutomatonChanged) {
            this.onAutomatonChanged(this.automaton);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasEditor;
}
