/**
 * JFLAP Online - Main Application
 */

class JFLAPApp {
    constructor() {
        // Initialize components
        this.canvas = document.getElementById('automata-canvas');
        this.renderer = new CanvasRenderer(this.canvas);
        this.editor = new CanvasEditor(this.canvas, this.renderer);
        this.simulator = new Simulator();

        // Current automaton
        this.automaton = null;
        this.machineType = 'dfa';

        // Code editor state
        this.codeEditorVisible = false;
        this.currentCodeTab = 'json';

        // Initialize
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.createNewAutomaton('dfa');
        this.setupEventListeners();
        this.setupModals();
        this.render();
    }

    /**
     * Create a new automaton of the specified type
     */
    createNewAutomaton(type) {
        this.machineType = type;

        switch (type) {
            case 'dfa':
                this.automaton = new DFA();
                break;
            case 'nfa':
                this.automaton = new NFA();
                break;
            case 'pda':
                this.automaton = new PDA();
                break;
            case 'tm':
                this.automaton = new TuringMachine();
                break;
            default:
                this.automaton = new DFA();
        }

        this.editor.setAutomaton(this.automaton);
        this.simulator.setAutomaton(this.automaton);
        this.updateCodeEditor();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Machine type selector
        const machineTypeSelect = document.getElementById('machine-type');
        if (machineTypeSelect) {
            machineTypeSelect.addEventListener('change', (e) => {
                if (confirm('Changing machine type will clear the current automaton. Continue?')) {
                    this.createNewAutomaton(e.target.value);
                } else {
                    e.target.value = this.machineType;
                }
            });
        }

        // Tool buttons
        document.getElementById('tool-select')?.addEventListener('click', () => this.editor.setTool('select'));
        document.getElementById('tool-state')?.addEventListener('click', () => this.editor.setTool('state'));
        document.getElementById('tool-transition')?.addEventListener('click', () => this.editor.setTool('transition'));
        document.getElementById('tool-delete')?.addEventListener('click', () => this.editor.setTool('delete'));

        // Header buttons
        document.getElementById('btn-new')?.addEventListener('click', () => this.newAutomaton());
        document.getElementById('btn-save')?.addEventListener('click', () => this.save());
        document.getElementById('btn-load')?.addEventListener('click', () => this.load());
        document.getElementById('btn-export')?.addEventListener('click', () => this.export());
        document.getElementById('btn-help')?.addEventListener('click', () => this.showHelp());
        document.getElementById('btn-clear')?.addEventListener('click', () => this.clear());

        // Simulation buttons
        document.getElementById('btn-run')?.addEventListener('click', () => this.runSimulation());
        document.getElementById('btn-step')?.addEventListener('click', () => this.stepSimulation());
        document.getElementById('btn-reset')?.addEventListener('click', () => this.resetSimulation());

        // Batch testing
        document.getElementById('btn-batch-run')?.addEventListener('click', () => this.runBatchTests());

        // Code editor
        document.getElementById('btn-toggle-code')?.addEventListener('click', () => this.toggleCodeEditor());
        document.getElementById('btn-apply-code')?.addEventListener('click', () => this.applyCode());
        document.getElementById('btn-format-code')?.addEventListener('click', () => this.formatCode());
        document.getElementById('btn-copy-code')?.addEventListener('click', () => this.copyCode());

        // Code tabs
        document.querySelectorAll('.code-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setCodeTab(e.target.dataset.tab);
            });
        });

        // TM tape navigation
        document.getElementById('tape-left')?.addEventListener('click', () => this.scrollTape(-5));
        document.getElementById('tape-right')?.addEventListener('click', () => this.scrollTape(5));

        // Editor callbacks
        this.editor.onAutomatonChanged = () => {
            this.updateCodeEditor();
        };

        this.editor.onRequestTransitionInput = (from, to) => {
            this.showTransitionModal(from, to);
        };

        // Simulator callbacks - re-render canvas on each step to show active states
        this.simulator.onStepComplete = () => {
            this.render();
        };

        this.simulator.onSimulationComplete = () => {
            this.render();
        };

        // Custom events for modals
        document.addEventListener('openStateProperties', (e) => {
            this.showStateModal(e.detail.state);
        });

        document.addEventListener('openTransitionProperties', (e) => {
            this.showTransitionEditModal(e.detail.transition);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.save();
            } else if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.load();
            } else if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                if (this.simulator.isRunning) {
                    this.simulator.isPaused ? this.simulator.resume() : this.simulator.pause();
                } else {
                    this.runSimulation();
                }
            } else if (e.key === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.preventDefault();
                this.stepSimulation();
            }
        });

        // Input field enter key
        document.getElementById('input-string')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.runSimulation();
            }
        });
    }

    /**
     * Setup modal interactions
     */
    setupModals() {
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Help modal close
        document.getElementById('help-modal')?.querySelector('.modal-close')?.addEventListener('click', () => {
            document.getElementById('help-modal').classList.add('hidden');
        });
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    /**
     * New automaton
     */
    newAutomaton() {
        if (confirm('Create new automaton? Current work will be lost.')) {
            this.createNewAutomaton(this.machineType);
        }
    }

    /**
     * Clear all states and transitions
     */
    clear() {
        if (confirm('Clear all states and transitions?')) {
            this.automaton.clear();
            this.editor.clearSelection();
            this.render();
            this.updateCodeEditor();
        }
    }

    /**
     * Save automaton to file
     */
    save() {
        const json = JSON.stringify(this.automaton.toJSON(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `automaton_${this.machineType}_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Load automaton from file
     */
    load() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.jff';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target.result;

                    if (file.name.endsWith('.jff')) {
                        // Load JFLAP format
                        this.automaton = Automaton.fromJFLAPXML(content);
                    } else {
                        // Load JSON format
                        const json = JSON.parse(content);
                        this.createNewAutomaton(json.type || 'dfa');
                        this.automaton.loadFromJSON(json);
                    }

                    // Update UI
                    document.getElementById('machine-type').value = this.automaton.type;
                    this.machineType = this.automaton.type;
                    this.editor.setAutomaton(this.automaton);
                    this.simulator.setAutomaton(this.automaton);
                    this.render();
                    this.updateCodeEditor();
                } catch (error) {
                    alert('Error loading file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }

    /**
     * Export automaton
     */
    export() {
        const format = prompt('Export format (json/jflap):', 'json');
        if (!format) return;

        let content, filename, type;

        if (format.toLowerCase() === 'jflap' || format.toLowerCase() === 'jff') {
            content = this.automaton.toJFLAPXML();
            filename = `automaton_${this.machineType}.jff`;
            type = 'application/xml';
        } else {
            content = JSON.stringify(this.automaton.toJSON(), null, 2);
            filename = `automaton_${this.machineType}.json`;
            type = 'application/json';
        }

        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Show help modal
     */
    showHelp() {
        document.getElementById('help-modal').classList.remove('hidden');
    }

    /**
     * Run simulation
     */
    runSimulation() {
        const input = document.getElementById('input-string').value;
        this.simulator.init(input);
        this.simulator.run();
        this.render();
    }

    /**
     * Step simulation
     */
    stepSimulation() {
        this.simulator.step();
        this.render();
    }

    /**
     * Reset simulation
     */
    resetSimulation() {
        this.simulator.reset();
        this.render();
    }

    /**
     * Run batch tests
     */
    runBatchTests() {
        const textarea = document.getElementById('batch-inputs');
        const resultsContainer = document.getElementById('batch-results');

        if (!textarea || !resultsContainer) return;

        const inputs = textarea.value.split('\n').filter(s => s.length > 0 || textarea.value.includes('\n'));

        // Include empty string if explicitly entered
        if (textarea.value === '' || textarea.value.startsWith('\n')) {
            inputs.unshift('');
        }

        const results = this.simulator.runBatchTests(inputs);
        this.simulator.displayBatchResults(results, resultsContainer);
    }

    /**
     * Toggle code editor visibility
     */
    toggleCodeEditor() {
        this.codeEditorVisible = !this.codeEditorVisible;
        const container = document.getElementById('code-editor-container');
        if (container) {
            container.classList.toggle('hidden', !this.codeEditorVisible);
        }
        if (this.codeEditorVisible) {
            this.updateCodeEditor();
        }
    }

    /**
     * Set code editor tab
     */
    setCodeTab(tab) {
        this.currentCodeTab = tab;

        document.querySelectorAll('.code-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        this.updateCodeEditor();
    }

    /**
     * Update code editor content
     */
    updateCodeEditor() {
        const editor = document.getElementById('code-editor');
        if (!editor || !this.codeEditorVisible) return;

        if (this.currentCodeTab === 'json') {
            editor.value = JSON.stringify(this.automaton.toJSON(), null, 2);
        } else {
            editor.value = this.generateJavaScriptCode();
        }
    }

    /**
     * Generate JavaScript code for the automaton
     */
    generateJavaScriptCode() {
        const json = this.automaton.toJSON();
        let code = `// ${this.machineType.toUpperCase()} Definition\n\n`;

        code += `const automaton = new ${this.getClassName()}();\n\n`;
        code += `// States\n`;

        json.states.forEach(state => {
            code += `automaton.addState(new State({\n`;
            code += `    id: ${state.id},\n`;
            code += `    name: "${state.name}",\n`;
            code += `    x: ${state.x},\n`;
            code += `    y: ${state.y},\n`;
            code += `    isInitial: ${state.isInitial},\n`;
            code += `    isFinal: ${state.isFinal}\n`;
            code += `}));\n\n`;
        });

        code += `// Transitions\n`;
        json.transitions.forEach(t => {
            code += `automaton.addTransition(new Transition({\n`;
            code += `    fromState: automaton.getState(${t.fromState}),\n`;
            code += `    toState: automaton.getState(${t.toState}),\n`;

            if (this.machineType === 'tm') {
                code += `    readSymbol: "${t.readSymbol || ''}",\n`;
                code += `    writeSymbol: "${t.writeSymbol || ''}",\n`;
                code += `    direction: "${t.direction || 'R'}"\n`;
            } else if (this.machineType === 'pda') {
                code += `    symbols: ${JSON.stringify(t.symbols)},\n`;
                code += `    stackRead: "${t.stackRead || ''}",\n`;
                code += `    stackWrite: "${t.stackWrite || ''}"\n`;
            } else {
                code += `    symbols: ${JSON.stringify(t.symbols)}\n`;
            }

            code += `}));\n\n`;
        });

        code += `// Test the automaton\n`;
        code += `const input = "your_input_here";\n`;
        code += `automaton.initSimulation(input);\n`;
        code += `const accepted = automaton.run();\n`;
        code += `console.log(\`Input "\${input}" is \${accepted ? 'ACCEPTED' : 'REJECTED'}\`);\n`;

        return code;
    }

    /**
     * Get class name for current machine type
     */
    getClassName() {
        switch (this.machineType) {
            case 'dfa': return 'DFA';
            case 'nfa': return 'NFA';
            case 'pda': return 'PDA';
            case 'tm': return 'TuringMachine';
            default: return 'DFA';
        }
    }

    /**
     * Apply code from editor
     */
    applyCode() {
        const editor = document.getElementById('code-editor');
        if (!editor) return;

        try {
            if (this.currentCodeTab === 'json') {
                const json = JSON.parse(editor.value);
                this.createNewAutomaton(json.type || this.machineType);
                this.automaton.loadFromJSON(json);
                this.editor.setAutomaton(this.automaton);
                this.simulator.setAutomaton(this.automaton);
                this.render();
            } else {
                alert('JavaScript code cannot be applied directly. Use JSON format.');
            }
        } catch (error) {
            alert('Error parsing code: ' + error.message);
        }
    }

    /**
     * Format code in editor
     */
    formatCode() {
        const editor = document.getElementById('code-editor');
        if (!editor) return;

        try {
            if (this.currentCodeTab === 'json') {
                const json = JSON.parse(editor.value);
                editor.value = JSON.stringify(json, null, 2);
            }
        } catch (error) {
            alert('Error formatting: ' + error.message);
        }
    }

    /**
     * Copy code to clipboard
     */
    copyCode() {
        const editor = document.getElementById('code-editor');
        if (!editor) return;

        navigator.clipboard.writeText(editor.value).then(() => {
            // Visual feedback
            const btn = document.getElementById('btn-copy-code');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = originalText, 1500);
            }
        });
    }

    /**
     * Scroll TM tape
     */
    scrollTape(amount) {
        if (this.automaton && this.automaton.type === 'tm') {
            // Implementation would scroll the tape view
            this.simulator.updateTMTape();
        }
    }

    /**
     * Show transition input modal
     */
    showTransitionModal(fromState, toState) {
        const modal = document.getElementById('transition-modal');
        const form = document.getElementById('transition-form');

        if (!modal || !form) return;

        // Generate form based on machine type
        form.innerHTML = this.generateTransitionForm();

        modal.classList.remove('hidden');

        // Focus first input
        const firstInput = form.querySelector('input');
        if (firstInput) firstInput.focus();

        // Handle add button
        document.getElementById('btn-add-transition').onclick = () => {
            const label = this.getTransitionFormValue();
            if (label !== null) {
                this.editor.createTransition(fromState, toState, label);
                modal.classList.add('hidden');
            }
        };

        document.getElementById('btn-cancel-transition').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    /**
     * Generate transition form HTML based on machine type
     */
    generateTransitionForm() {
        switch (this.machineType) {
            case 'dfa':
                return `
                    <div class="form-group">
                        <label for="trans-symbol">Symbol:</label>
                        <input type="text" id="trans-symbol" placeholder="a" maxlength="1">
                        <small>Enter a single symbol</small>
                    </div>
                `;

            case 'nfa':
                return `
                    <div class="form-group">
                        <label for="trans-symbol">Symbol(s):</label>
                        <input type="text" id="trans-symbol" placeholder="a,b or ε">
                        <small>Enter symbol(s) separated by commas. Use ε for epsilon.</small>
                    </div>
                `;

            case 'pda':
                return `
                    <div class="form-group">
                        <label for="trans-input">Input Symbol:</label>
                        <input type="text" id="trans-input" placeholder="a or ε">
                    </div>
                    <div class="form-group">
                        <label for="trans-pop">Pop from Stack:</label>
                        <input type="text" id="trans-pop" placeholder="Z or ε">
                    </div>
                    <div class="form-group">
                        <label for="trans-push">Push to Stack:</label>
                        <input type="text" id="trans-push" placeholder="AZ or ε">
                    </div>
                `;

            case 'tm':
                return `
                    <div class="form-group">
                        <label for="trans-read">Read Symbol:</label>
                        <input type="text" id="trans-read" placeholder="0 or □" maxlength="1">
                    </div>
                    <div class="form-group">
                        <label for="trans-write">Write Symbol:</label>
                        <input type="text" id="trans-write" placeholder="1 or □" maxlength="1">
                    </div>
                    <div class="form-group">
                        <label for="trans-direction">Move Direction:</label>
                        <select id="trans-direction">
                            <option value="R">Right (R)</option>
                            <option value="L">Left (L)</option>
                            <option value="S">Stay (S)</option>
                        </select>
                    </div>
                `;

            default:
                return `
                    <div class="form-group">
                        <label for="trans-symbol">Symbol:</label>
                        <input type="text" id="trans-symbol">
                    </div>
                `;
        }
    }

    /**
     * Get value from transition form
     */
    getTransitionFormValue() {
        switch (this.machineType) {
            case 'dfa':
            case 'nfa':
                return document.getElementById('trans-symbol')?.value || '';

            case 'pda':
                const input = document.getElementById('trans-input')?.value || 'ε';
                const pop = document.getElementById('trans-pop')?.value || 'ε';
                const push = document.getElementById('trans-push')?.value || 'ε';
                return `${input},${pop};${push}`;

            case 'tm':
                const read = document.getElementById('trans-read')?.value || '□';
                const write = document.getElementById('trans-write')?.value || '□';
                const dir = document.getElementById('trans-direction')?.value || 'R';
                return `${read};${write},${dir}`;

            default:
                return document.getElementById('trans-symbol')?.value || '';
        }
    }

    /**
     * Show state properties modal
     */
    showStateModal(state) {
        const modal = document.getElementById('state-modal');
        if (!modal) return;

        document.getElementById('state-name').value = state.name;
        document.getElementById('state-initial').checked = state.isInitial;
        document.getElementById('state-final').checked = state.isFinal;

        modal.classList.remove('hidden');

        document.getElementById('btn-save-state').onclick = () => {
            state.name = document.getElementById('state-name').value || state.name;

            const wasInitial = state.isInitial;
            const makeInitial = document.getElementById('state-initial').checked;

            if (makeInitial && !wasInitial) {
                this.automaton.setInitialState(state);
            } else if (!makeInitial && wasInitial) {
                state.isInitial = false;
                this.automaton.initialState = null;
            }

            state.isFinal = document.getElementById('state-final').checked;

            modal.classList.add('hidden');
            this.render();
            this.updateCodeEditor();
        };

        document.getElementById('btn-delete-state').onclick = () => {
            this.editor.deleteState(state);
            modal.classList.add('hidden');
        };

        document.getElementById('btn-cancel-state').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    /**
     * Show transition edit modal
     */
    showTransitionEditModal(transition) {
        // For simplicity, use the same modal but for editing
        const modal = document.getElementById('transition-modal');
        const form = document.getElementById('transition-form');

        if (!modal || !form) return;

        form.innerHTML = this.generateTransitionForm();
        modal.classList.remove('hidden');

        // Pre-fill values
        this.prefillTransitionForm(transition);

        document.getElementById('btn-add-transition').textContent = 'Save';
        document.getElementById('btn-add-transition').onclick = () => {
            const label = this.getTransitionFormValue();
            if (label !== null) {
                const parsed = Transition.parseLabel(label, this.machineType);
                Object.assign(transition, parsed);
                modal.classList.add('hidden');
                document.getElementById('btn-add-transition').textContent = 'Add';
                this.render();
                this.updateCodeEditor();
            }
        };

        document.getElementById('btn-cancel-transition').onclick = () => {
            modal.classList.add('hidden');
            document.getElementById('btn-add-transition').textContent = 'Add';
        };
    }

    /**
     * Pre-fill transition form with existing values
     */
    prefillTransitionForm(transition) {
        switch (this.machineType) {
            case 'dfa':
            case 'nfa':
                const symbolInput = document.getElementById('trans-symbol');
                if (symbolInput) symbolInput.value = transition.symbols.join(',');
                break;

            case 'pda':
                document.getElementById('trans-input').value = transition.symbols[0] || '';
                document.getElementById('trans-pop').value = transition.stackRead || '';
                document.getElementById('trans-push').value = transition.stackWrite || '';
                break;

            case 'tm':
                document.getElementById('trans-read').value = transition.readSymbol || '';
                document.getElementById('trans-write').value = transition.writeSymbol || '';
                document.getElementById('trans-direction').value = transition.direction || 'R';
                break;
        }
    }

    /**
     * Render the canvas
     */
    render() {
        this.editor.render();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new JFLAPApp();
});
