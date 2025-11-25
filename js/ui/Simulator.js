/**
 * Simulator - Handles automaton simulation and UI updates
 */
class Simulator {
    constructor() {
        this.automaton = null;
        this.isRunning = false;
        this.isPaused = false;
        this.speed = 5; // 1-10 scale
        this.stepInterval = null;

        // UI Elements
        this.inputField = document.getElementById('input-string');
        this.statusBadge = document.getElementById('sim-status');
        this.currentStateDisplay = document.getElementById('sim-current-state');
        this.remainingInputDisplay = document.getElementById('sim-remaining');
        this.stackDisplay = document.getElementById('sim-stack');
        this.stackContainer = document.getElementById('stack-display');
        this.traceOutput = document.getElementById('trace-output');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');

        // TM Elements
        this.tmTapeContainer = document.getElementById('tm-tape-container');
        this.tmTape = document.getElementById('tm-tape');
        this.headPositionDisplay = document.getElementById('head-position');
        this.currentTMStateDisplay = document.getElementById('current-tm-state');

        // Callbacks
        this.onStepComplete = null;
        this.onSimulationComplete = null;

        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.speedSlider) {
            this.speedSlider.addEventListener('input', (e) => {
                this.speed = parseInt(e.target.value);
                if (this.speedValue) {
                    this.speedValue.textContent = this.speed;
                }
            });
        }
    }

    /**
     * Set the automaton
     */
    setAutomaton(automaton) {
        this.automaton = automaton;
        this.reset();
        this.updateMachineTypeUI();
    }

    /**
     * Update UI based on machine type
     */
    updateMachineTypeUI() {
        if (!this.automaton) return;

        // Show/hide stack display for PDA
        if (this.stackContainer) {
            this.stackContainer.style.display = this.automaton.type === 'pda' ? 'flex' : 'none';
        }

        // Show/hide TM tape
        if (this.tmTapeContainer) {
            this.tmTapeContainer.classList.toggle('hidden', this.automaton.type !== 'tm');
        }
    }

    /**
     * Initialize simulation with input
     */
    init(input) {
        if (!this.automaton) return false;

        const success = this.automaton.initSimulation(input || '');

        this.updateStatus('ready');
        this.updateDisplay();

        return success;
    }

    /**
     * Reset simulation
     */
    reset() {
        this.stop();

        if (this.automaton) {
            this.automaton.resetSimulation();
        }

        this.updateStatus('ready');
        this.clearTrace();
        this.updateDisplay();
    }

    /**
     * Perform one step
     */
    step() {
        if (!this.automaton) return false;

        // Initialize if not already
        if (this.automaton.trace.length === 0) {
            const input = this.inputField ? this.inputField.value : '';
            this.init(input);
        }

        const continued = this.automaton.step();
        this.updateDisplay();
        this.appendTrace();

        if (this.onStepComplete) {
            this.onStepComplete(this.automaton);
        }

        if (!continued || this.automaton.isAccepted !== null) {
            this.complete();
            return false;
        }

        return true;
    }

    /**
     * Run simulation automatically
     */
    run() {
        if (!this.automaton) return;

        // Initialize if not already
        if (this.automaton.trace.length === 0) {
            const input = this.inputField ? this.inputField.value : '';
            this.init(input);
        }

        this.isRunning = true;
        this.isPaused = false;
        this.updateStatus('running');

        // Calculate interval based on speed
        const interval = Math.max(50, 1000 - (this.speed * 90));

        this.stepInterval = setInterval(() => {
            if (this.isPaused) return;

            const continued = this.step();
            if (!continued) {
                this.stop();
            }
        }, interval);
    }

    /**
     * Pause simulation
     */
    pause() {
        this.isPaused = true;
        this.updateStatus('paused');
    }

    /**
     * Resume simulation
     */
    resume() {
        this.isPaused = false;
        this.updateStatus('running');
    }

    /**
     * Stop simulation
     */
    stop() {
        if (this.stepInterval) {
            clearInterval(this.stepInterval);
            this.stepInterval = null;
        }
        this.isRunning = false;
        this.isPaused = false;
    }

    /**
     * Mark simulation as complete
     */
    complete() {
        this.stop();

        if (this.automaton.isAccepted === true) {
            this.updateStatus('accepted');
        } else if (this.automaton.isAccepted === false) {
            this.updateStatus('rejected');
        }

        if (this.onSimulationComplete) {
            this.onSimulationComplete(this.automaton, this.automaton.isAccepted);
        }
    }

    /**
     * Update status badge
     */
    updateStatus(status) {
        if (!this.statusBadge) return;

        this.statusBadge.className = 'status-badge';
        switch (status) {
            case 'ready':
                this.statusBadge.textContent = 'Ready';
                break;
            case 'running':
                this.statusBadge.textContent = 'Running';
                this.statusBadge.classList.add('running');
                break;
            case 'paused':
                this.statusBadge.textContent = 'Paused';
                break;
            case 'accepted':
                this.statusBadge.textContent = 'Accepted';
                this.statusBadge.classList.add('accepted');
                break;
            case 'rejected':
                this.statusBadge.textContent = 'Rejected';
                this.statusBadge.classList.add('rejected');
                break;
        }
    }

    /**
     * Update current state display
     */
    updateDisplay() {
        if (!this.automaton) return;

        // Current state(s)
        if (this.currentStateDisplay) {
            const states = Array.from(this.automaton.currentStates).map(s => s.name);
            if (states.length === 0) {
                this.currentStateDisplay.textContent = '(none)';
            } else if (states.length === 1) {
                this.currentStateDisplay.textContent = states[0];
            } else {
                this.currentStateDisplay.innerHTML = `<div class="config-set">${states.map(s =>
                    `<span class="config-badge">${s}</span>`
                ).join('')}</div>`;
            }
        }

        // Remaining input
        if (this.remainingInputDisplay) {
            const remaining = this.automaton.input.substring(this.automaton.inputIndex);
            this.remainingInputDisplay.textContent = remaining || '(empty)';
        }

        // Stack (for PDA)
        if (this.stackDisplay && this.automaton.type === 'pda') {
            this.stackDisplay.textContent = this.automaton.getStackString();
        }

        // TM tape
        if (this.automaton.type === 'tm') {
            this.updateTMTape();
        }
    }

    /**
     * Update Turing Machine tape display
     */
    updateTMTape() {
        if (!this.tmTape || !this.automaton || this.automaton.type !== 'tm') return;

        const cells = this.automaton.getDisplayTape(21);
        this.tmTape.innerHTML = '';

        cells.forEach(cell => {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'tape-cell';
            if (cell.isHead) {
                cellDiv.classList.add('head');
            }
            if (cell.symbol === this.automaton.blankSymbol) {
                cellDiv.classList.add('blank');
            }
            cellDiv.textContent = cell.symbol;
            cellDiv.title = `Position: ${cell.position}`;
            this.tmTape.appendChild(cellDiv);
        });

        // Update head position display
        if (this.headPositionDisplay) {
            this.headPositionDisplay.textContent = this.automaton.headPosition + this.automaton.visibleTapeStart;
        }

        // Update current state
        if (this.currentTMStateDisplay) {
            const state = Array.from(this.automaton.currentStates)[0];
            this.currentTMStateDisplay.textContent = state ? state.name : '-';
        }
    }

    /**
     * Clear trace output
     */
    clearTrace() {
        if (this.traceOutput) {
            this.traceOutput.innerHTML = '';
        }
    }

    /**
     * Append latest trace step
     */
    appendTrace() {
        if (!this.traceOutput || !this.automaton) return;

        const trace = this.automaton.trace;
        if (trace.length === 0) return;

        const lastStep = trace[trace.length - 1];

        // Remove 'current' class from previous step
        const prevCurrent = this.traceOutput.querySelector('.trace-step.current');
        if (prevCurrent) {
            prevCurrent.classList.remove('current');
        }

        const stepDiv = document.createElement('div');
        stepDiv.className = 'trace-step current';
        stepDiv.textContent = `Step ${lastStep.step}: ${lastStep.description}`;
        this.traceOutput.appendChild(stepDiv);

        // Scroll to bottom
        this.traceOutput.scrollTop = this.traceOutput.scrollHeight;
    }

    /**
     * Test a single string
     */
    testString(input) {
        if (!this.automaton) return null;

        // Create a copy of the automaton for testing
        const testAutomaton = this.createTestCopy();
        testAutomaton.initSimulation(input);
        const result = testAutomaton.run();

        return {
            input: input,
            accepted: result,
            trace: testAutomaton.trace
        };
    }

    /**
     * Run batch tests
     */
    runBatchTests(inputs) {
        const results = [];

        inputs.forEach(input => {
            const result = this.testString(input);
            if (result) {
                results.push(result);
            }
        });

        return results;
    }

    /**
     * Create a copy of the automaton for testing
     */
    createTestCopy() {
        if (!this.automaton) return null;

        const json = this.automaton.toJSON();
        let copy;

        switch (this.automaton.type) {
            case 'dfa':
                copy = new DFA();
                break;
            case 'nfa':
                copy = new NFA();
                break;
            case 'pda':
                copy = new PDA();
                break;
            case 'tm':
                copy = new TuringMachine();
                break;
            default:
                copy = new NFA();
        }

        copy.loadFromJSON(json, true);
        return copy;
    }

    /**
     * Display batch test results
     */
    displayBatchResults(results, container) {
        if (!container) return;

        container.innerHTML = '';

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'batch-result';

            const inputSpan = document.createElement('span');
            inputSpan.className = 'input-str';
            inputSpan.textContent = result.input || '(empty)';

            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'result-badge ' + (result.accepted ? 'accepted' : 'rejected');
            badgeSpan.textContent = result.accepted ? 'Accepted' : 'Rejected';

            resultDiv.appendChild(inputSpan);
            resultDiv.appendChild(badgeSpan);
            container.appendChild(resultDiv);
        });
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Simulator;
}
