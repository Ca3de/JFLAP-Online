/**
 * Simulator - drives a machine and renders the inspector panel:
 * verdict, input string with a read head, current states, PDA stack,
 * TM tape, step trace and the batch tester.
 */
class Simulator {
    constructor() {
        this.automaton = null;
        this.isRunning = false;
        this.isPaused = false;
        this.speed = 7;
        this.stepInterval = null;
        this.status = 'ready';

        this.inputField = document.getElementById('input-string');
        this.verdict = document.getElementById('verdict');
        this.verdictText = document.getElementById('verdict-text');
        this.verdictNote = document.getElementById('verdict-note');
        this.inputStrip = document.getElementById('input-strip');
        this.stateChips = document.getElementById('state-chips');
        this.stateCount = document.getElementById('state-count');
        this.stackBlock = document.getElementById('stack-block');
        this.stackView = document.getElementById('stack-view');
        this.tapeBlock = document.getElementById('tape-block');
        this.tapeView = document.getElementById('tape-view');
        this.headPos = document.getElementById('head-pos');
        this.traceView = document.getElementById('trace');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');

        this.onStepComplete = null;
        this.onSimulationComplete = null;

        if (this.speedSlider) {
            this.speedSlider.addEventListener('input', (e) => {
                this.speed = parseInt(e.target.value, 10);
                if (this.speedValue) this.speedValue.textContent = this.speed;
                if (this.isRunning) { this.stop(); this.run(true); }
            });
        }
    }

    setAutomaton(automaton) {
        this.stop();
        this.automaton = automaton;
        this.updateMachineTypeUI();
        this.reset();
    }

    updateMachineTypeUI() {
        if (!this.automaton) return;
        this.stackBlock.classList.toggle('hidden', this.automaton.type !== 'pda');
        this.tapeBlock.classList.toggle('hidden', this.automaton.type !== 'tm');
        if (this.inputField) {
            this.inputField.placeholder = this.automaton.type === 'tm'
                ? 'tape contents' : 'input string';
        }
    }

    /* ------------------------------------------------------------ lifecycle */

    init(input) {
        if (!this.automaton) return false;
        const started = this.automaton.initSimulation(input || '');
        this.setStatus('ready');
        this.renderTrace();
        this.render();
        return started;
    }

    reset() {
        this.stop();
        if (this.automaton) {
            this.automaton.initSimulation(this.inputField ? this.inputField.value : '');
            this.automaton.trace = [];
        }
        this.setStatus('ready');
        this.renderTrace();
        this.render();
    }

    /** True when the machine has not been initialised for the current input. */
    needsInit() {
        if (!this.automaton) return true;
        if (this.automaton.trace.length === 0) return true;
        const current = this.inputField ? this.inputField.value : '';
        return this.automaton.input !== current;
    }

    step() {
        if (!this.automaton) return false;
        if (this.needsInit()) this.init(this.inputField ? this.inputField.value : '');

        const finished = this.automaton.isAccepted !== null;
        if (finished) return false;

        const continued = this.automaton.step();

        this.render();
        this.renderTrace();
        if (this.onStepComplete) this.onStepComplete(this.automaton);

        if (!continued || this.automaton.isAccepted !== null) {
            this.complete();
            return false;
        }

        // Mid-run, whether the steps came from the play loop or the button.
        this.setStatus('running');
        return true;
    }

    run(keepInit = false) {
        if (!this.automaton) return;
        if (!keepInit) this.init(this.inputField ? this.inputField.value : '');

        this.isRunning = true;
        this.isPaused = false;
        this.setStatus('running');

        const interval = Math.max(35, 900 - this.speed * 88);
        this.stepInterval = setInterval(() => {
            if (this.isPaused) return;
            if (!this.step()) this.stop();
        }, interval);
    }

    pause() { this.isPaused = true; this.setStatus('paused'); }
    resume() { this.isPaused = false; this.setStatus('running'); }

    stop() {
        if (this.stepInterval) {
            clearInterval(this.stepInterval);
            this.stepInterval = null;
        }
        this.isRunning = false;
        this.isPaused = false;
    }

    complete() {
        this.stop();
        if (this.automaton.isAccepted === true) this.setStatus('accepted');
        else if (this.automaton.isAccepted === false) this.setStatus('rejected');
        else this.setStatus('ready');
        this.render();
        if (this.onSimulationComplete) {
            this.onSimulationComplete(this.automaton, this.automaton.isAccepted);
        }
    }

    /* ------------------------------------------------------------ rendering */

    setStatus(status) {
        this.status = status;
        if (!this.verdict) return;

        const labels = {
            ready: 'Ready',
            running: 'Running',
            paused: 'Paused',
            accepted: 'Accepted',
            rejected: 'Rejected'
        };
        const classes = {
            running: 'is-running',
            paused: 'is-running',
            accepted: 'is-accepted',
            rejected: 'is-rejected'
        };

        this.verdict.className = `verdict ${classes[status] || ''}`.trim();
        this.verdictText.textContent = labels[status] || 'Ready';

        let note = '';
        if (this.automaton) {
            const steps = Math.max(0, this.automaton.trace.length - 1);
            if (status === 'accepted' || status === 'rejected' || status === 'running') {
                note = `${steps} step${steps === 1 ? '' : 's'}`;
            } else if (status === 'ready') {
                note = this.automaton.input ? 'press Run' : '';
            }
        }
        this.verdictNote.textContent = note;
    }

    render() {
        if (!this.automaton) return;
        this.renderInputStrip();
        this.renderStates();
        if (this.automaton.type === 'pda') this.renderStack();
        if (this.automaton.type === 'tm') this.renderTape();
    }

    /** The input string, split into consumed / current / remaining. */
    renderInputStrip() {
        if (!this.inputStrip) return;
        this.inputStrip.textContent = '';

        if (this.automaton.type === 'tm') return; // the tape view covers it

        const input = this.automaton.input || '';
        if (input.length === 0) {
            this.inputStrip.appendChild(
                el('span', { class: 'cell-empty' }, 'ε — the empty string'));
            return;
        }

        const index = Math.max(0, Math.min(input.length, this.automaton.inputIndex));
        const done = this.automaton.isAccepted !== null;

        for (let i = 0; i < input.length; i++) {
            let cls = 'cell remaining';
            if (i < index) cls = 'cell consumed';
            else if (i === index && !done) cls = 'cell current';
            this.inputStrip.appendChild(el('div', { class: cls }, input[i]));
        }
    }

    renderStates() {
        if (!this.stateChips) return;
        this.stateChips.textContent = '';

        const names = Array.from(this.automaton.currentStates).map(s => s.name);
        if (names.length === 0) {
            this.stateChips.appendChild(el('span', { class: 'chip chip-empty' }, 'no live state'));
        } else {
            names.forEach(name => this.stateChips.appendChild(el('span', { class: 'chip' }, name)));
        }

        if (this.stateCount) {
            this.stateCount.textContent = names.length > 1 ? `${names.length} live` : '';
        }
    }

    renderStack() {
        if (!this.stackView) return;
        this.stackView.textContent = '';
        const stack = this.automaton.stack || [];

        if (stack.length === 0) {
            this.stackView.appendChild(el('div', { class: 'stack-cell' }, 'empty'));
            return;
        }
        stack.forEach((symbol, i) => {
            this.stackView.appendChild(el('div', {
                class: `stack-cell${i === stack.length - 1 ? ' top' : ''}`
            }, symbol));
        });
    }

    renderTape() {
        if (!this.tapeView) return;
        this.tapeView.textContent = '';

        const cells = this.automaton.getDisplayTape(25);
        cells.forEach(cell => {
            const blank = cell.symbol === this.automaton.blankSymbol;
            this.tapeView.appendChild(el('div', {
                class: `cell${cell.isHead ? ' head' : ''}${blank ? ' blank' : ''}`,
                title: `position ${cell.position}`
            }, cell.symbol));
        });

        if (this.headPos) {
            this.headPos.textContent = `head ${this.automaton.headPosition + this.automaton.visibleTapeStart}`;
        }

        const head = this.tapeView.querySelector('.head');
        if (head && head.scrollIntoView) {
            head.scrollIntoView({ block: 'nearest', inline: 'center' });
        }
    }

    renderTrace() {
        if (!this.traceView) return;
        this.traceView.textContent = '';
        if (!this.automaton) return;

        this.automaton.trace.forEach((entry, i) => {
            const last = i === this.automaton.trace.length - 1;
            this.traceView.appendChild(el('div', {
                class: `trace-step${last ? ' current' : ''}`
            }, [
                el('span', { class: 'n' }, String(entry.step)),
                el('span', { class: 'd' }, entry.description || '')
            ]));
        });

        this.traceView.scrollTop = this.traceView.scrollHeight;
    }

    /* --------------------------------------------------------------- batch */

    /** A line reading 'ε' means the empty string; blank lines are ignored. */
    static parseBatchInputs(text) {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => (line === 'ε' || line === 'ϵ') ? '' : line);
    }

    createTestCopy() {
        if (!this.automaton) return null;
        const json = this.automaton.toJSON();
        let copy;
        switch (this.automaton.type) {
            case 'nfa': copy = new NFA(); break;
            case 'pda': copy = new PDA(); break;
            case 'tm': copy = new TuringMachine(); break;
            default: copy = new DFA(); break;
        }
        copy.loadFromJSON(json);
        return copy;
    }

    testString(input) {
        const copy = this.createTestCopy();
        if (!copy) return null;
        copy.initSimulation(input);
        return { input, accepted: copy.run() === true };
    }

    runBatchTests(inputs) {
        return inputs.map(input => this.testString(input)).filter(Boolean);
    }

    /**
     * Render batch results. `expectations` maps a string to the verdict the
     * example claims, so a mismatch is called out rather than quietly shown.
     */
    displayBatchResults(results, container, summary, expectations = null) {
        if (!container) return;
        container.textContent = '';

        let mismatches = 0;
        results.forEach(result => {
            const expected = expectations ? expectations.get(result.input) : undefined;
            const wrong = expected !== undefined && expected !== result.accepted;
            if (wrong) mismatches++;

            container.appendChild(el('div', { class: 'batch-row' }, [
                el('span', { class: 's' }, result.input === '' ? 'ε' : result.input),
                wrong ? el('span', { class: 'x' }, `expected ${expected ? 'accept' : 'reject'}`) : null,
                el('span', {
                    class: `v ${result.accepted ? 'yes' : 'no'}`
                }, result.accepted ? 'accept' : 'reject')
            ]));
        });

        if (summary) {
            summary.textContent = '';
            const accepted = results.filter(r => r.accepted).length;
            summary.appendChild(el('span', { class: 'batch-pass' },
                `${accepted} accepted`));
            summary.appendChild(el('span', { class: 'batch-fail' },
                `${results.length - accepted} rejected`));
            if (expectations) {
                summary.appendChild(el('span', {
                    class: mismatches === 0 ? 'batch-pass' : 'batch-fail'
                }, mismatches === 0 ? 'all as documented' : `${mismatches} unexpected`));
            }
            summary.classList.toggle('hidden', results.length === 0);
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Simulator;
}
