/**
 * CanvasEditor - mouse and keyboard interaction with the canvas.
 */
class CanvasEditor {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.automaton = null;

        this.currentTool = 'select';

        this.isDragging = false;
        this.didDrag = false;
        this.isPanning = false;
        this.spaceHeld = false;
        this.isDrawingTransition = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };

        this.selectedState = null;
        this.selectedTransition = null;
        this.transitionStartState = null;

        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectedStates = new Set();

        // Callbacks
        this.onStateSelected = null;
        this.onTransitionSelected = null;
        this.onStateCreated = null;
        this.onTransitionCreated = null;
        this.onAutomatonChanged = null;
        this.onViewChanged = null;
        this.onRequestTransitionInput = null;

        this.setupEventListeners();
    }

    setAutomaton(automaton) {
        this.automaton = automaton;
        this.clearSelection();
        this.render();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('blur', () => { this.spaceHeld = false; this.isPanning = false; });
    }

    /* ------------------------------------------------------------- geometry */

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return this.renderer.toWorldCoords(e.clientX - rect.left, e.clientY - rect.top);
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    getStateAt(x, y) {
        if (!this.automaton) return null;
        for (let i = this.automaton.states.length - 1; i >= 0; i--) {
            const state = this.automaton.states[i];
            if (state.containsPoint(x, y)) return state;
        }
        return null;
    }

    /**
     * Nearest transition within a tolerance, measured against the curve the
     * renderer actually drew - a straight-line test misses every bowed edge.
     */
    getTransitionAt(x, y) {
        if (!this.automaton) return null;
        const tolerance = Math.max(8, 12 / this.renderer.scale);
        let best = null;
        let bestDistance = tolerance;

        for (const transition of this.automaton.transitions) {
            const d = this.renderer.distanceToTransition(x, y, transition, this.automaton);
            if (d < bestDistance) {
                bestDistance = d;
                best = transition;
            }
        }
        return best;
    }

    /* --------------------------------------------------------------- mouse */

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.dragStart = { ...pos };
        this.lastMouse = { x: e.clientX, y: e.clientY };

        if (e.button === 1 || this.spaceHeld) {
            this.isPanning = true;
            e.preventDefault();
            return;
        }
        if (e.button === 2) return;

        const state = this.getStateAt(pos.x, pos.y);
        const transition = state ? null : this.getTransitionAt(pos.x, pos.y);

        switch (this.currentTool) {
            case 'select':
                if (state) {
                    this.selectState(state);
                    this.isDragging = true;
                    this.didDrag = false;
                    this.dragOffset = { x: pos.x - state.x, y: pos.y - state.y };
                } else if (transition) {
                    this.selectTransition(transition);
                } else {
                    this.clearSelection();
                    this.isSelecting = true;
                    this.selectionStart = { ...pos };
                }
                break;

            case 'state':
                if (!state) this.createState(pos.x, pos.y);
                break;

            case 'transition':
                if (state) {
                    this.transitionStartState = state;
                    this.isDrawingTransition = true;
                }
                break;

            case 'delete':
                if (state) this.deleteState(state);
                else if (transition) this.deleteTransition(transition);
                break;
        }

        this.render();
    }

    onMouseMove(e) {
        if (this.isPanning) {
            this.renderer.pan(e.clientX - this.lastMouse.x, e.clientY - this.lastMouse.y);
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
            if (this.onViewChanged) this.onViewChanged();
            return;
        }

        const pos = this.getMousePos(e);

        if (this.isDragging && this.selectedState) {
            this.selectedState.moveTo(pos.x - this.dragOffset.x, pos.y - this.dragOffset.y);
            this.didDrag = true;
            this.render();
            return;
        }

        if (this.isDrawingTransition && this.transitionStartState) {
            this.render();
            this.renderer.drawTransitionPreview(this.transitionStartState, pos.x, pos.y);
            return;
        }

        if (this.isSelecting) {
            this.render();
            this.renderer.drawSelectionBox(this.selectionStart.x, this.selectionStart.y, pos.x, pos.y);
            return;
        }

        this.updateCursor(pos);
    }

    updateCursor(pos) {
        if (this.spaceHeld) { this.canvas.style.cursor = 'grab'; return; }

        switch (this.currentTool) {
            case 'state': this.canvas.style.cursor = 'crosshair'; return;
            case 'transition': this.canvas.style.cursor = 'crosshair'; return;
            case 'delete':
                this.canvas.style.cursor =
                    (this.getStateAt(pos.x, pos.y) || this.getTransitionAt(pos.x, pos.y))
                        ? 'pointer' : 'default';
                return;
            default:
                if (this.getStateAt(pos.x, pos.y)) this.canvas.style.cursor = 'grab';
                else if (this.getTransitionAt(pos.x, pos.y)) this.canvas.style.cursor = 'pointer';
                else this.canvas.style.cursor = 'default';
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.spaceHeld ? 'grab' : 'default';
            return;
        }

        const pos = this.getMousePos(e);

        if (this.isDrawingTransition && this.transitionStartState) {
            const target = this.getStateAt(pos.x, pos.y);
            if (target) this.requestTransitionInput(this.transitionStartState, target);
            this.transitionStartState = null;
            this.isDrawingTransition = false;
        }

        if (this.isSelecting) {
            this.selectStatesInBox(this.selectionStart.x, this.selectionStart.y, pos.x, pos.y);
            this.isSelecting = false;
        }

        // A completed drag is one undoable action, not one per mouse-move.
        if (this.isDragging && this.didDrag && this.automaton) {
            this.automaton.saveToHistory();
            this.notifyChange();
        }

        this.isDragging = false;
        this.didDrag = false;
        this.render();
    }

    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const state = this.getStateAt(pos.x, pos.y);
        const transition = state ? null : this.getTransitionAt(pos.x, pos.y);

        if (state) this.openStateProperties(state);
        else if (transition) this.openTransitionProperties(transition);
        else if (this.currentTool !== 'delete') this.createState(pos.x, pos.y);
    }

    onContextMenu(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const state = this.getStateAt(pos.x, pos.y);
        const transition = state ? null : this.getTransitionAt(pos.x, pos.y);

        if (state) this.showStateContextMenu(e.clientX, e.clientY, state);
        else if (transition) this.showTransitionContextMenu(e.clientX, e.clientY, transition);
    }

    /** Zoom toward the cursor rather than the canvas origin. */
    onWheel(e) {
        e.preventDefault();
        const pos = this.getCanvasPos(e);
        this.renderer.zoomAt(e.deltaY > 0 ? 0.9 : 1.1, pos.x, pos.y);
        this.render();
        if (this.onViewChanged) this.onViewChanged();
    }

    /* ------------------------------------------------------------ keyboard */

    isTyping(e) {
        const tag = e.target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
    }

    modalOpen() {
        return !!document.querySelector('.modal:not(.hidden)');
    }

    onKeyDown(e) {
        if (e.key === ' ' && !this.isTyping(e) && !this.modalOpen()) {
            if (!this.spaceHeld) {
                this.spaceHeld = true;
                this.canvas.style.cursor = 'grab';
            }
            e.preventDefault();
            return;
        }

        if (this.isTyping(e) || this.modalOpen()) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) this.redo(); else this.undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            this.redo();
            return;
        }
        if (e.ctrlKey || e.metaKey) return;

        switch (e.key.toLowerCase()) {
            case 'v': this.setTool('select'); break;
            case 's': this.setTool('state'); break;
            case 't': this.setTool('transition'); break;
            case 'd': this.setTool('delete'); break;
            case 'f':
                this.renderer.fitToView(this.automaton);
                this.render();
                if (this.onViewChanged) this.onViewChanged();
                break;
            case 'delete':
            case 'backspace':
                if (this.selectedState) this.deleteState(this.selectedState);
                else if (this.selectedTransition) this.deleteTransition(this.selectedTransition);
                break;
            case 'escape':
                this.clearSelection();
                this.isDrawingTransition = false;
                this.transitionStartState = null;
                this.render();
                break;
        }
    }

    onKeyUp(e) {
        if (e.key === ' ') {
            this.spaceHeld = false;
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
    }

    undo() {
        if (this.automaton && this.automaton.undo()) {
            this.clearSelection();
            this.notifyChange();
            this.render();
        }
    }

    redo() {
        if (this.automaton && this.automaton.redo()) {
            this.clearSelection();
            this.notifyChange();
            this.render();
        }
    }

    /* --------------------------------------------------------------- tools */

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        this.canvas.style.cursor = (tool === 'state' || tool === 'transition') ? 'crosshair' : 'default';
    }

    /* -------------------------------------------------------------- edits */

    createState(x, y) {
        if (!this.automaton) return;
        const state = new State({
            x, y,
            isInitial: this.automaton.states.length === 0
        });
        this.automaton.addState(state);
        this.selectState(state);
        this.notifyChange();
        if (this.onStateCreated) this.onStateCreated(state);
        this.render();
    }

    requestTransitionInput(fromState, toState) {
        if (this.onRequestTransitionInput) {
            this.onRequestTransitionInput(fromState, toState);
        } else {
            const label = prompt('Transition label:', '');
            if (label !== null) this.createTransition(fromState, toState, label);
        }
    }

    createTransition(fromState, toState, labelInput) {
        if (!this.automaton) return;
        const parsed = Transition.parseLabel(labelInput, this.automaton.type);
        const transition = new Transition({ fromState, toState, ...parsed });
        this.automaton.addTransition(transition);
        this.selectTransition(transition);
        this.notifyChange();
        if (this.onTransitionCreated) this.onTransitionCreated(transition);
        this.render();
    }

    deleteState(state) {
        if (!this.automaton) return;
        this.automaton.removeState(state);
        this.clearSelection();
        this.notifyChange();
        this.render();
    }

    deleteTransition(transition) {
        if (!this.automaton) return;
        this.automaton.removeTransition(transition);
        this.clearSelection();
        this.notifyChange();
        this.render();
    }

    /* ---------------------------------------------------------- selection */

    selectState(state) {
        this.clearSelection();
        state.selected = true;
        this.selectedState = state;
        if (this.onStateSelected) this.onStateSelected(state);
    }

    selectTransition(transition) {
        this.clearSelection();
        transition.selected = true;
        this.selectedTransition = transition;
        if (this.onTransitionSelected) this.onTransitionSelected(transition);
    }

    clearSelection() {
        if (this.automaton) {
            this.automaton.states.forEach(s => s.selected = false);
            this.automaton.transitions.forEach(t => t.selected = false);
        }
        this.selectedState = null;
        this.selectedTransition = null;
        this.selectedStates.clear();
    }

    selectStatesInBox(x1, y1, x2, y2) {
        if (!this.automaton) return;
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

        this.clearSelection();
        this.automaton.states.forEach(state => {
            if (state.x >= minX && state.x <= maxX && state.y >= minY && state.y <= maxY) {
                state.selected = true;
                this.selectedStates.add(state);
            }
        });

        if (this.selectedStates.size === 1) {
            this.selectedState = Array.from(this.selectedStates)[0];
            if (this.onStateSelected) this.onStateSelected(this.selectedState);
        }
    }

    /* ------------------------------------------------------- context menus */

    openStateProperties(state) {
        document.dispatchEvent(new CustomEvent('openStateProperties', { detail: { state } }));
    }

    openTransitionProperties(transition) {
        document.dispatchEvent(new CustomEvent('openTransitionProperties', { detail: { transition } }));
    }

    buildContextMenu(x, y, items) {
        this.removeContextMenu();
        const menu = el('div', { class: 'context-menu' });
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        items.forEach(item => {
            if (item.divider) {
                menu.appendChild(el('div', { class: 'context-menu-divider' }));
                return;
            }
            menu.appendChild(el('div', {
                class: 'context-menu-item',
                onclick: () => { item.action(); this.removeContextMenu(); }
            }, item.label));
        });

        document.body.appendChild(menu);
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;

        setTimeout(() => {
            document.addEventListener('mousedown', () => this.removeContextMenu(), { once: true });
        }, 0);
    }

    showStateContextMenu(x, y, state) {
        this.buildContextMenu(x, y, [
            { label: 'Edit…', action: () => this.openStateProperties(state) },
            { label: state.isInitial ? 'Remove start marker' : 'Make start state', action: () => this.toggleInitial(state) },
            { label: state.isFinal ? 'Remove accepting' : 'Make accepting', action: () => this.toggleFinal(state) },
            { divider: true },
            { label: 'Delete state', action: () => this.deleteState(state) }
        ]);
    }

    showTransitionContextMenu(x, y, transition) {
        this.buildContextMenu(x, y, [
            { label: 'Edit…', action: () => this.openTransitionProperties(transition) },
            { divider: true },
            { label: 'Delete transition', action: () => this.deleteTransition(transition) }
        ]);
    }

    removeContextMenu() {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
    }

    toggleInitial(state) {
        if (state.isInitial) {
            state.isInitial = false;
            this.automaton.initialState = null;
            this.automaton.saveToHistory();
        } else {
            this.automaton.setInitialState(state);
        }
        this.notifyChange();
        this.render();
    }

    toggleFinal(state) {
        state.isFinal = !state.isFinal;
        this.automaton.saveToHistory();
        this.notifyChange();
        this.render();
    }

    /* -------------------------------------------------------------- render */

    render() {
        if (this.automaton) this.renderer.render(this.automaton);
        else this.renderer.clear();
    }

    notifyChange() {
        if (this.onAutomatonChanged) this.onAutomatonChanged(this.automaton);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasEditor;
}
