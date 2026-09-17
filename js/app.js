/**
 * JFLAP Online - application shell.
 */
class JFLAPApp {
    constructor() {
        this.canvas = document.getElementById('automata-canvas');
        this.renderer = new CanvasRenderer(this.canvas);
        this.editor = new CanvasEditor(this.canvas, this.renderer);
        this.simulator = new Simulator();

        this.automaton = null;
        this.machineType = 'dfa';
        this.currentExample = null;
        this.galleryFilter = 'all';
        this.toastTimer = null;

        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.buildGallery();

        // Open on the headline example so the tool explains itself.
        const featured = Examples.byId('keypad');
        if (featured) this.loadExample(featured, { silent: true });
        else this.createNewAutomaton('dfa');

        window.addEventListener('resize', () => {
            this.renderer.resize();
            this.render();
        });
    }

    /* --------------------------------------------------------------- theme */

    setupTheme() {
        this.applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            let stored = null;
            try { stored = localStorage.getItem('jflap-theme'); } catch (e) { /* ignore */ }
            if (!stored) this.applyTheme(media.matches ? 'dark' : 'light');
        };
        if (media.addEventListener) media.addEventListener('change', onChange);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        // The canvas cannot inherit CSS - re-read the palette and repaint.
        this.renderer.refreshTheme();
        this.render();
    }

    toggleTheme() {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('jflap-theme', next); } catch (e) { /* ignore */ }
        this.applyTheme(next);
        this.toast(`${next === 'dark' ? 'Dark' : 'Light'} theme`);
    }

    /* ------------------------------------------------------------ machines */

    createNewAutomaton(type) {
        this.machineType = type;
        switch (type) {
            case 'nfa': this.automaton = new NFA(); break;
            case 'pda': this.automaton = new PDA(); break;
            case 'tm': this.automaton = new TuringMachine(); break;
            default: this.automaton = new DFA(); break;
        }

        // Seed the timeline so the first edit is undoable back to empty.
        this.automaton.saveToHistory();

        this.currentExample = null;
        this.attach();
    }

    /** Wire a freshly built automaton into the editor, simulator and UI. */
    attach() {
        document.getElementById('machine-type').value = this.automaton.type;
        this.machineType = this.automaton.type;

        this.editor.setAutomaton(this.automaton);
        this.simulator.setAutomaton(this.automaton);

        this.renderer.fitToView(this.automaton);
        this.render();
        this.syncUI();
    }

    loadExample(example, options = {}) {
        this.automaton = Examples.build(example);
        this.currentExample = example;
        this.attach();

        const input = document.getElementById('input-string');
        if (input) input.value = Examples.decodeString(example.accept[0] || '');

        const batch = document.getElementById('batch-inputs');
        if (batch) {
            batch.value = [...example.accept, ...example.reject].join('\n');
        }
        document.getElementById('batch-results').textContent = '';
        document.getElementById('batch-summary').classList.add('hidden');

        this.simulator.reset();
        this.showExamplePanel(example);
        this.render();

        if (!options.silent) this.toast(`Loaded ${example.name}`);
    }

    showExamplePanel(example) {
        const panel = document.getElementById('example-panel');
        if (!panel) return;

        if (!example) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');
        document.getElementById('example-name').textContent = example.name;
        document.getElementById('example-blurb').textContent = example.blurb;
        document.getElementById('example-idea').textContent = example.idea;

        const note = document.getElementById('example-note');
        note.textContent = example.note || '';
        note.classList.toggle('hidden', !example.note);

        const meta = document.getElementById('example-meta');
        meta.textContent = '';
        meta.appendChild(el('span', { class: 'tag tag-accent' }, example.type.toUpperCase()));
        meta.appendChild(el('span', { class: 'tag mono' },
            `Σ = {${example.alphabet.join(', ')}}`));
        meta.appendChild(el('span', { class: 'tag' },
            `${example.accept.length} accept · ${example.reject.length} reject`));
    }

    /* -------------------------------------------------------------- gallery */

    buildGallery() {
        const filters = document.getElementById('gallery-filters');
        filters.textContent = '';

        Examples.categories.forEach(category => {
            filters.appendChild(el('button', {
                class: `filter${category.id === this.galleryFilter ? ' active' : ''}`,
                dataset: { filter: category.id },
                onclick: () => {
                    this.galleryFilter = category.id;
                    this.buildGallery();
                }
            }, category.label));
        });

        const grid = document.getElementById('gallery-grid');
        grid.textContent = '';

        const shown = Examples.all.filter(e =>
            this.galleryFilter === 'all' || e.type === this.galleryFilter);

        shown.forEach(example => {
            grid.appendChild(el('button', {
                class: 'card',
                onclick: () => {
                    this.closeModals();
                    this.loadExample(example);
                }
            }, [
                el('div', { class: 'card-top' }, [
                    el('span', { class: 'card-kind' }, example.type.toUpperCase()),
                    example.featured ? el('span', { class: 'card-star' }, 'start here') : null
                ]),
                el('div', { class: 'card-name' }, example.name),
                el('div', { class: 'card-blurb' }, example.blurb)
            ]));
        });

        document.getElementById('gallery-count').textContent =
            `${shown.length} of ${Examples.all.length}`;
    }

    /* --------------------------------------------------------------- events */

    setupEventListeners() {
        document.getElementById('machine-type').addEventListener('change', (e) => {
            const type = e.target.value;
            if (this.automaton && this.automaton.states.length > 0 &&
                !confirm('Switching machine type starts a new, empty machine. Continue?')) {
                e.target.value = this.machineType;
                return;
            }
            this.createNewAutomaton(type);
            this.showExamplePanel(null);
            this.simulator.reset();
        });

        document.querySelectorAll('.tool[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this.editor.setTool(btn.dataset.tool));
        });

        document.getElementById('btn-zoom-in').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.zoom(1 / 1.2));
        document.getElementById('btn-fit').addEventListener('click', () => {
            this.renderer.fitToView(this.automaton);
            this.render();
        });

        document.getElementById('btn-examples').addEventListener('click', () => this.openGallery());
        document.getElementById('btn-empty-examples').addEventListener('click', () => this.openGallery());
        document.getElementById('btn-new').addEventListener('click', () => this.newAutomaton());
        document.getElementById('btn-open').addEventListener('click', () => this.open());
        document.getElementById('btn-save').addEventListener('click', () => this.save());
        document.getElementById('btn-help').addEventListener('click', () => this.openModal('help-modal'));
        document.getElementById('btn-theme').addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-undo').addEventListener('click', () => this.editor.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.editor.redo());

        document.getElementById('btn-run').addEventListener('click', () => this.runSimulation());
        document.getElementById('btn-step').addEventListener('click', () => this.stepSimulation());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetSimulation());
        document.getElementById('btn-batch').addEventListener('click', () => this.runBatchTests());

        document.getElementById('input-string').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runSimulation();
        });
        document.getElementById('input-string').addEventListener('input', () => {
            this.simulator.reset();
            this.render();
        });

        // Modals
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModals();
        });

        // Editor callbacks
        this.editor.onAutomatonChanged = () => this.syncUI();
        this.editor.onViewChanged = () => this.syncUI();
        this.editor.onRequestTransitionInput = (from, to) => this.showTransitionModal(from, to);
        this.simulator.onStepComplete = () => this.render();
        this.simulator.onSimulationComplete = () => this.render();

        document.addEventListener('openStateProperties', (e) => this.showStateModal(e.detail.state));
        document.addEventListener('openTransitionProperties', (e) =>
            this.showTransitionEditModal(e.detail.transition));

        // Global shortcuts
        document.addEventListener('keydown', (e) => {
            const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.save();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                this.open();
            } else if (e.key === 'ArrowRight' && !typing && !this.anyModalOpen()) {
                e.preventDefault();
                this.stepSimulation();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.runSimulation();
            }
        });
    }

    zoom(factor) {
        this.renderer.zoomAt(factor, this.renderer.width / 2, this.renderer.height / 2);
        this.render();
        this.syncUI();
    }

    /* ---------------------------------------------------------------- modals */

    anyModalOpen() {
        return !!document.querySelector('.modal:not(.hidden)');
    }

    openModal(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }

    openGallery() {
        this.buildGallery();
        this.openModal('gallery-modal');
    }

    /* ----------------------------------------------------------- simulation */

    runSimulation() {
        this.simulator.run();
        this.render();
    }

    stepSimulation() {
        this.simulator.step();
        this.render();
    }

    resetSimulation() {
        this.simulator.reset();
        this.render();
    }

    runBatchTests() {
        const textarea = document.getElementById('batch-inputs');
        const results = document.getElementById('batch-results');
        const summary = document.getElementById('batch-summary');

        const inputs = Simulator.parseBatchInputs(textarea.value);
        if (inputs.length === 0) {
            results.textContent = '';
            summary.classList.add('hidden');
            this.toast('Nothing to test');
            return;
        }

        // When an example is loaded, hold each verdict against what it claims.
        let expectations = null;
        if (this.currentExample) {
            expectations = new Map();
            Examples.testStrings(this.currentExample).forEach(c => {
                expectations.set(c.input, c.expected);
            });
        }

        const outcomes = this.simulator.runBatchTests(inputs);
        this.simulator.displayBatchResults(outcomes, results, summary, expectations);
    }

    /* ------------------------------------------------------------ file i/o */

    newAutomaton() {
        if (this.automaton && this.automaton.states.length > 0 &&
            !confirm('Start a new, empty machine? Unsaved work will be lost.')) return;
        this.createNewAutomaton(this.machineType);
        this.showExamplePanel(null);
        document.getElementById('batch-inputs').value = '';
        document.getElementById('batch-results').textContent = '';
        document.getElementById('batch-summary').classList.add('hidden');
        this.simulator.reset();
        this.toast('New machine');
    }

    save() {
        const name = this.currentExample ? this.currentExample.id : this.machineType;
        const json = JSON.stringify(this.automaton.toJSON(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('Saved');
    }

    open() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.jff';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    if (file.name.endsWith('.jff')) {
                        this.automaton = Automaton.fromJFLAPXML(event.target.result);
                        this.automaton.saveToHistory();
                    } else {
                        const json = JSON.parse(event.target.result);
                        this.createNewAutomaton(json.type || 'dfa');
                        this.automaton.loadFromJSON(json);
                    }
                    this.currentExample = null;
                    this.showExamplePanel(null);
                    this.attach();
                    this.simulator.reset();
                    this.toast(`Opened ${file.name}`);
                } catch (error) {
                    this.toast(`Could not open: ${error.message}`);
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    /* ------------------------------------------------------ transition form */

    showTransitionModal(fromState, toState) {
        const form = document.getElementById('transition-form');
        document.getElementById('transition-title').textContent = 'Add transition';
        form.innerHTML = this.transitionFormHtml();
        this.openModal('transition-modal');

        const first = form.querySelector('input');
        if (first) setTimeout(() => first.focus(), 30);

        const submit = () => {
            const label = this.readTransitionForm();
            this.editor.createTransition(fromState, toState, label);
            this.closeModals();
        };

        form.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
        document.getElementById('btn-add-transition').textContent = 'Add';
        document.getElementById('btn-add-transition').onclick = submit;
        document.getElementById('btn-cancel-transition').onclick = () => this.closeModals();
    }

    showTransitionEditModal(transition) {
        const form = document.getElementById('transition-form');
        document.getElementById('transition-title').textContent = 'Edit transition';
        form.innerHTML = this.transitionFormHtml();
        this.openModal('transition-modal');
        this.fillTransitionForm(transition);

        const submit = () => {
            const parsed = Transition.parseLabel(this.readTransitionForm(), this.machineType);
            Object.assign(transition, parsed);
            this.automaton.saveToHistory();
            this.closeModals();
            this.render();
            this.syncUI();
        };

        form.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
        document.getElementById('btn-add-transition').textContent = 'Save';
        document.getElementById('btn-add-transition').onclick = submit;
        document.getElementById('btn-cancel-transition').onclick = () => this.closeModals();
    }

    transitionFormHtml() {
        switch (this.machineType) {
            case 'dfa':
                return `
                    <div class="form-group">
                        <label for="trans-symbol">Symbols</label>
                        <input type="text" id="trans-symbol" class="control mono" placeholder="2, 3, 4">
                        <small>A comma-separated set. Deterministic as long as the sets leaving this state do not overlap.</small>
                    </div>`;
            case 'nfa':
                return `
                    <div class="form-group">
                        <label for="trans-symbol">Symbols</label>
                        <input type="text" id="trans-symbol" class="control mono" placeholder="a, b">
                        <small>Comma-separated, or ε for a move that consumes nothing.</small>
                    </div>`;
            case 'pda':
                return `
                    <div class="form-group">
                        <label for="trans-input">Read</label>
                        <input type="text" id="trans-input" class="control mono" placeholder="a or ε">
                    </div>
                    <div class="form-group">
                        <label for="trans-pop">Pop</label>
                        <input type="text" id="trans-pop" class="control mono" placeholder="Z or ε">
                        <small>ε pops nothing.</small>
                    </div>
                    <div class="form-group">
                        <label for="trans-push">Push</label>
                        <input type="text" id="trans-push" class="control mono" placeholder="AZ or ε">
                        <small>The leftmost character ends up on top.</small>
                    </div>`;
            case 'tm':
                return `
                    <div class="form-group">
                        <label for="trans-read">Read</label>
                        <input type="text" id="trans-read" class="control mono" placeholder="0 or □" maxlength="1">
                    </div>
                    <div class="form-group">
                        <label for="trans-write">Write</label>
                        <input type="text" id="trans-write" class="control mono" placeholder="1 or □" maxlength="1">
                    </div>
                    <div class="form-group">
                        <label for="trans-direction">Move</label>
                        <select id="trans-direction" class="control">
                            <option value="R">Right</option>
                            <option value="L">Left</option>
                            <option value="S">Stay</option>
                        </select>
                    </div>`;
            default:
                return '<div class="form-group"><input type="text" id="trans-symbol" class="control"></div>';
        }
    }

    readTransitionForm() {
        const value = (id, fallback = '') => {
            const node = document.getElementById(id);
            const v = node ? node.value.trim() : '';
            return v === '' ? fallback : v;
        };

        switch (this.machineType) {
            case 'pda':
                return `${value('trans-input', 'ε')},${value('trans-pop', 'ε')};${value('trans-push', 'ε')}`;
            case 'tm':
                return `${value('trans-read', '□')};${value('trans-write', '□')},${value('trans-direction', 'R')}`;
            default:
                return value('trans-symbol');
        }
    }

    fillTransitionForm(transition) {
        const set = (id, v) => {
            const node = document.getElementById(id);
            if (node) node.value = v == null ? '' : v;
        };

        switch (this.machineType) {
            case 'pda':
                set('trans-input', transition.symbols[0] || 'ε');
                set('trans-pop', transition.stackRead || 'ε');
                set('trans-push', transition.stackWrite || 'ε');
                break;
            case 'tm':
                set('trans-read', transition.readSymbol || '□');
                set('trans-write', transition.writeSymbol || '□');
                set('trans-direction', transition.direction || 'R');
                break;
            default:
                set('trans-symbol', transition.symbols.join(', '));
        }
    }

    /* ----------------------------------------------------------- state form */

    showStateModal(state) {
        document.getElementById('state-name').value = state.name;
        document.getElementById('state-initial').checked = state.isInitial;
        document.getElementById('state-final').checked = state.isFinal;
        this.openModal('state-modal');
        setTimeout(() => document.getElementById('state-name').select(), 30);

        const submit = () => {
            const name = document.getElementById('state-name').value.trim();
            state.name = name || state.name;

            const makeInitial = document.getElementById('state-initial').checked;
            if (makeInitial && !state.isInitial) {
                this.automaton.setInitialState(state);
            } else if (!makeInitial && state.isInitial) {
                state.isInitial = false;
                this.automaton.initialState = null;
            }
            state.isFinal = document.getElementById('state-final').checked;

            this.automaton.saveToHistory();
            this.closeModals();
            this.render();
            this.syncUI();
        };

        document.getElementById('btn-save-state').onclick = submit;
        document.getElementById('state-name').onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
        };
        document.getElementById('btn-delete-state').onclick = () => {
            this.editor.deleteState(state);
            this.closeModals();
        };
        document.getElementById('btn-cancel-state').onclick = () => this.closeModals();
    }

    /* ---------------------------------------------------------------- misc */

    toast(message) {
        const node = document.getElementById('toast');
        node.textContent = message;
        node.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => node.classList.remove('show'), 1900);
    }

    /** Keep the chrome in step with the model: counts, zoom, undo/redo state. */
    syncUI() {
        if (!this.automaton) return;

        const states = this.automaton.states.length;
        const transitions = this.automaton.transitions.length;

        document.getElementById('badge-counts').textContent =
            `${states} state${states === 1 ? '' : 's'} · ${transitions} transition${transitions === 1 ? '' : 's'}`;
        document.getElementById('badge-zoom').textContent =
            `${Math.round(this.renderer.scale * 100)}%`;
        document.getElementById('canvas-empty').classList.toggle('hidden', states > 0);

        document.getElementById('btn-undo').disabled = !this.automaton.canUndo();
        document.getElementById('btn-redo').disabled = !this.automaton.canRedo();

        this.simulator.updateMachineTypeUI();
        this.simulator.render();
    }

    render() {
        this.editor.render();
        this.syncUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new JFLAPApp();
});
