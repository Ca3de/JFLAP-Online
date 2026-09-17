/**
 * Drives the real page in headless Chromium: loads every example through the
 * UI, runs simulations to a verdict, edits with the mouse, toggles the theme
 * and exercises undo/redo. Screenshots land in tools/shots/.
 *
 * Run: node tools/verify-ui.js [--shots-only]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
const PORT = 8731;

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml'
};

let passed = 0;
let failed = 0;
const check = (name, condition, detail = '') => {
    if (condition) { passed++; console.log(`  ok    ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const url = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, url === '/' ? 'index.html' : url);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404); res.end('not found'); return;
            }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
            res.end(fs.readFileSync(file));
        });
        server.listen(PORT, () => resolve(server));
    });
}

(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    const server = await serve();

    const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2
    });

    const errors = [];
    // The sandbox MITMs TLS, so the Google Fonts stylesheet fails to load here.
    // That is an environment artefact, not a defect: the page has a full
    // system-font fallback stack. Real script errors still surface.
    const isEnvironmentNoise = (text) =>
        /ERR_CERT|fonts\.googleapis|fonts\.gstatic|ERR_NAME_NOT_RESOLVED/.test(text);

    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => {
        if (m.type() === 'error' && !isEnvironmentNoise(m.text())) errors.push(m.text());
    });

    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.app && window.app.automaton);

    console.log('\nPage load\n');
    check('no page errors on load', errors.length === 0, errors.join(' | '));
    check('opens on the keypad example',
        await page.evaluate(() => window.app.currentExample && window.app.currentExample.id) === 'keypad');
    check('canvas is HiDPI',
        await page.evaluate(() => {
            const c = document.getElementById('automata-canvas');
            return c.width > c.getBoundingClientRect().width;
        }));

    await page.screenshot({ path: path.join(SHOTS, '01-keypad-light.png') });

    /* ---------------------------------------------------- every example ---- */

    console.log('\nLoading all 15 examples through the UI\n');

    const ids = await page.evaluate(() => Examples.all.map(e => e.id));
    check('gallery lists 15 examples', ids.length === 15, `got ${ids.length}`);

    for (const id of ids) {
        errors.length = 0;
        const result = await page.evaluate(async (exampleId) => {
            const app = window.app;
            app.loadExample(Examples.byId(exampleId), { silent: true });

            // Run the whole declared suite through the UI's own batch tester.
            const example = Examples.byId(exampleId);
            const expectations = Examples.testStrings(example);
            const outcomes = expectations.map(c => ({
                input: c.input,
                expected: c.expected,
                got: app.simulator.testString(c.input).accepted
            }));

            return {
                states: app.automaton.states.length,
                transitions: app.automaton.transitions.length,
                type: app.automaton.type,
                panelVisible: !document.getElementById('example-panel').classList.contains('hidden'),
                mismatches: outcomes.filter(o => o.expected !== o.got)
                    .map(o => `${o.input || 'ε'}: want ${o.expected}`),
                batchLines: document.getElementById('batch-inputs').value.split('\n').length
            };
        }, id);

        const okAll = result.mismatches.length === 0 && result.states > 0 &&
                      result.panelVisible && errors.length === 0;
        check(`${id.padEnd(18)} ${result.states}s/${result.transitions}t ${result.batchLines} test strings`,
            okAll, [...result.mismatches, ...errors].join(' | '));
    }

    /* ------------------------------------------------------- simulations --- */

    console.log('\nSimulations run to a verdict in the UI\n');

    const runInUI = async (exampleId, input) => {
        return page.evaluate(async ([id, text]) => {
            const app = window.app;
            app.loadExample(Examples.byId(id), { silent: true });
            document.getElementById('input-string').value = text;
            document.getElementById('input-string')
                .dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('btn-run').click();

            await new Promise(resolve => {
                const started = Date.now();
                const tick = () => {
                    if (!app.simulator.isRunning || Date.now() - started > 15000) resolve();
                    else setTimeout(tick, 25);
                };
                tick();
            });

            return {
                verdict: document.getElementById('verdict-text').textContent,
                cls: document.getElementById('verdict').className,
                traceSteps: document.querySelectorAll('.trace-step').length,
                strip: document.querySelectorAll('#input-strip .cell').length,
                chips: [...document.querySelectorAll('#state-chips .chip')].map(c => c.textContent)
            };
        }, [exampleId, input]);
    };

    // Speed up the auto-runner so the checks do not take minutes.
    await page.evaluate(() => { window.app.simulator.speed = 10; });

    const simCases = [
        ['keypad', '1231234', 'Accepted'],
        ['keypad', '12314', 'Rejected'],
        ['keypad-nfa', '1231234', 'Accepted'],
        ['vending', 'dndn', 'Accepted'],
        ['vending', 'dnd', 'Rejected'],
        ['balanced', '(()())', 'Accepted'],
        ['balanced', '(()', 'Rejected'],
        ['anbn', 'aaabbb', 'Accepted'],
        ['palindrome-pda', 'abba', 'Accepted'],
        ['binary-increment', '1011', 'Accepted'],
        ['palindrome-tm', 'abaaba', 'Accepted'],
        ['palindrome-tm', 'abaab', 'Rejected'],
        ['unary-add', '111+11', 'Accepted']
    ];

    for (const [id, input, expected] of simCases) {
        const r = await runInUI(id, input);
        check(`${id.padEnd(18)} "${input}" -> ${r.verdict}`,
            r.verdict === expected && r.traceSteps > 0,
            `expected ${expected}, trace ${r.traceSteps} steps`);
    }

    /* ------------------------------------------------------------ visuals -- */

    console.log('\nScreenshots\n');

    const shoot = async (exampleId, file, options = {}) => {
        await page.evaluate((id) => {
            window.app.loadExample(Examples.byId(id), { silent: true });
            window.app.renderer.fitToView(window.app.automaton);
            window.app.render();
        }, exampleId);
        if (options.input) {
            await page.fill('#input-string', options.input);
            if (options.steps) {
                for (let i = 0; i < options.steps; i++) await page.click('#btn-step');
            }
        }
        await page.waitForTimeout(120);
        await page.screenshot({ path: path.join(SHOTS, file) });
        console.log(`  saved ${file}`);
    };

    await shoot('keypad', '02-keypad.png');
    await shoot('vending', '03-vending.png');
    await shoot('keypad-nfa', '04-keypad-nfa.png');
    await shoot('even-even', '05-parity.png');
    await shoot('div-by-3', '06-divby3.png');
    await shoot('comment-scanner', '07-comments.png');
    await shoot('email', '08-email.png');
    await shoot('balanced', '09-balanced.png');
    await shoot('palindrome-pda', '10-palindrome-pda.png', { input: 'abba', steps: 4 });
    check('PDA stack is shown while stepping',
        await page.evaluate(() => document.querySelectorAll('#stack-view .stack-cell').length) > 1);
    check('a stepped run reports progress, not "Ready"',
        await page.evaluate(() => document.getElementById('verdict-text').textContent) === 'Running');
    await shoot('palindrome-tm', '11-palindrome-tm.png', { input: 'abaaba', steps: 5 });
    await shoot('binary-increment', '12-increment.png', { input: '111', steps: 4 });
    await shoot('unary-add', '13-unary.png');
    await shoot('anbn', '14-anbn.png');
    await shoot('abb', '15-abb.png');
    await shoot('ends-01', '16-ends01.png');

    // Gallery
    await page.click('#btn-examples');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, '20-gallery.png') });
    check('gallery shows every example',
        await page.evaluate(() => document.querySelectorAll('#gallery-grid .card').length) === 15);
    await page.evaluate(() => {
        document.querySelector('[data-filter="pda"]').click();
    });
    await page.waitForTimeout(120);
    check('category filter narrows the gallery',
        await page.evaluate(() => document.querySelectorAll('#gallery-grid .card').length) === 3);
    await page.screenshot({ path: path.join(SHOTS, '21-gallery-filtered.png') });
    await page.keyboard.press('Escape');

    /* -------------------------------------------------------------- theme -- */

    console.log('\nTheme\n');

    await page.evaluate(() => {
        window.app.loadExample(Examples.byId('vending'), { silent: true });
    });
    await page.click('#btn-theme');
    await page.waitForTimeout(200);

    const darkCanvas = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'),
        stored: localStorage.getItem('jflap-theme'),
        rendererBg: window.app.renderer.colors.background,
        cssBg: getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim()
    }));
    check('theme flips to dark', darkCanvas.theme === 'dark');
    check('theme is remembered in localStorage', darkCanvas.stored === 'dark');
    check('canvas palette follows the CSS variables',
        darkCanvas.rendererBg === darkCanvas.cssBg,
        `${darkCanvas.rendererBg} vs ${darkCanvas.cssBg}`);

    await page.screenshot({ path: path.join(SHOTS, '30-vending-dark.png') });
    await page.evaluate(() => {
        window.app.loadExample(Examples.byId('palindrome-tm'), { silent: true });
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, '31-tm-dark.png') });

    await page.click('#btn-theme');
    await page.waitForTimeout(150);

    /* ------------------------------------------------------- mouse editing - */

    console.log('\nEditing with the mouse\n');

    await page.evaluate(() => { window.app.newAutomatonForTest = true; });
    await page.evaluate(() => {
        window.app.createNewAutomaton('dfa');
        window.app.showExamplePanel(null);
        window.app.renderer.resetView();
        window.app.render();
    });

    const box = await page.locator('#automata-canvas').boundingBox();
    const at = (wx, wy) => page.evaluate(([x, y]) => {
        const r = window.app.renderer;
        const c = r.toCanvasCoords(x, y);
        const rect = document.getElementById('automata-canvas').getBoundingClientRect();
        return { x: rect.left + c.x, y: rect.top + c.y };
    }, [wx, wy]);

    // Place two states with the state tool.
    await page.click('#tool-state');
    let p = await at(220, 260); await page.mouse.click(p.x, p.y);
    p = await at(480, 260); await page.mouse.click(p.x, p.y);

    check('two states placed by clicking',
        await page.evaluate(() => window.app.automaton.states.length) === 2);

    // Drag a transition between them; the modal asks for the label.
    await page.click('#tool-transition');
    const a = await at(220, 260);
    const b = await at(480, 260);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, a.y - 40, { steps: 8 });
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForSelector('#transition-modal:not(.hidden)');
    await page.fill('#trans-symbol', '0, 1');
    await page.click('#btn-add-transition');

    const created = await page.evaluate(() => {
        const t = window.app.automaton.transitions[0];
        return t ? t.symbols : null;
    });
    check('transition drawn by dragging, DFA takes a symbol SET',
        JSON.stringify(created) === JSON.stringify(['0', '1']), JSON.stringify(created));

    // Drag a state to a new position.
    await page.click('#tool-select');
    const from = await at(480, 260);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 90, from.y + 70, { steps: 10 });
    await page.mouse.up();

    const moved = await page.evaluate(() => {
        const s = window.app.automaton.states[1];
        return { x: Math.round(s.x), y: Math.round(s.y) };
    });
    check('state dragged with the mouse', moved.x > 520 && moved.y > 290,
        `landed at ${moved.x},${moved.y}`);

    await page.screenshot({ path: path.join(SHOTS, '40-hand-built.png') });

    /* ---------------------------------------------------------- undo/redo -- */

    console.log('\nUndo / redo in the UI\n');

    const snapshot = () => page.evaluate(() => ({
        states: window.app.automaton.states.length,
        transitions: window.app.automaton.transitions.length,
        x: window.app.automaton.states[1] ? Math.round(window.app.automaton.states[1].x) : null,
        undo: !document.getElementById('btn-undo').disabled,
        redo: !document.getElementById('btn-redo').disabled
    }));

    const before = await snapshot();
    await page.click('#btn-undo');                      // undo the move
    const afterUndo1 = await snapshot();
    check('undo reverts the drag', afterUndo1.x !== before.x, `${before.x} -> ${afterUndo1.x}`);
    check('redo becomes available', afterUndo1.redo === true);

    await page.click('#btn-undo');                      // undo the transition
    const afterUndo2 = await snapshot();
    check('undo removes the transition', afterUndo2.transitions === 0,
        `${afterUndo2.transitions} left`);

    await page.click('#btn-redo');
    await page.click('#btn-redo');
    const afterRedo = await snapshot();
    check('redo restores both edits',
        afterRedo.transitions === 1 && afterRedo.x === before.x,
        JSON.stringify(afterRedo));

    // Keyboard undo
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Control+z');
    check('Ctrl+Z undoes',
        (await snapshot()).x !== before.x);
    await page.keyboard.press('Control+y');
    check('Ctrl+Y redoes',
        (await snapshot()).x === before.x);

    /* ------------------------------------------------------------- viewport */

    console.log('\nViewport\n');

    await page.evaluate(() => {
        window.app.loadExample(Examples.byId('vending'), { silent: true });
    });

    const fitted = await page.evaluate(() => {
        const app = window.app;
        app.renderer.fitToView(app.automaton);
        const b = app.renderer.getBounds(app.automaton);
        const topLeft = app.renderer.toCanvasCoords(b.minX, b.minY);
        const bottomRight = app.renderer.toCanvasCoords(b.maxX, b.maxY);
        return {
            scale: app.renderer.scale,
            topLeft, bottomRight,
            w: app.renderer.width, h: app.renderer.height,
            bounds: b
        };
    });
    check('fit-to-view keeps the whole diagram on screen',
        fitted.topLeft.x >= -1 && fitted.topLeft.y >= -1 &&
        fitted.bottomRight.x <= fitted.w + 1 && fitted.bottomRight.y <= fitted.h + 1,
        JSON.stringify(fitted));
    check('fit-to-view bounds include the deflected edge bow',
        fitted.bounds.maxY > 400,
        `maxY ${Math.round(fitted.bounds.maxY)} (states sit at y=220)`);

    const zoomed = await page.evaluate(() => {
        const r = window.app.renderer;
        const before = r.toWorldCoords(300, 200);
        r.zoomAt(1.5, 300, 200);
        const after = r.toWorldCoords(300, 200);
        return { dx: Math.abs(after.x - before.x), dy: Math.abs(after.y - before.y) };
    });
    check('zoom keeps the point under the cursor fixed',
        zoomed.dx < 0.01 && zoomed.dy < 0.01, JSON.stringify(zoomed));

    /* ----------------------------------------------------------- escaping -- */

    console.log('\nEscaping\n');

    const escaped = await page.evaluate(() => {
        const app = window.app;
        app.createNewAutomaton('dfa');
        const evil = new State({ name: '<img src=x onerror="window.__pwned=1">', x: 200, y: 200 });
        app.automaton.addState(evil);
        app.automaton.initSimulation('');
        app.render();
        const chips = document.getElementById('state-chips');
        return {
            pwned: !!window.__pwned,
            html: chips.innerHTML,
            text: chips.textContent
        };
    });
    check('machine-authored names do not execute', escaped.pwned === false);
    check('name is escaped in the inspector',
        escaped.html.includes('&lt;img') && escaped.text.includes('<img'),
        escaped.html.slice(0, 80));

    /* ----------------------------------------------------------- batch UI -- */

    console.log('\nBatch tester\n');

    const batch = await page.evaluate(async () => {
        window.app.loadExample(Examples.byId('vending'), { silent: true });
        document.getElementById('btn-batch').click();
        const rows = [...document.querySelectorAll('.batch-row')];
        return {
            rows: rows.length,
            unexpected: rows.filter(r => r.querySelector('.x')).length,
            summary: document.getElementById('batch-summary').textContent
        };
    });
    check(`batch tester ran ${batch.rows} strings from the example`, batch.rows === 19,
        `${batch.rows} rows`);
    check('every verdict matches what the example documents',
        batch.unexpected === 0 && batch.summary.includes('all as documented'), batch.summary);

    await page.evaluate(() => {
        const inspector = document.getElementById('inspector');
        inspector.scrollTop = inspector.scrollHeight;
    });
    await page.waitForTimeout(120);
    await page.locator('#inspector').screenshot({ path: path.join(SHOTS, '41-batch.png') });

    /* --------------------------------------------------------------- done -- */

    errors.length = 0;
    await page.evaluate(() => {
        Examples.all.forEach(e => window.app.loadExample(e, { silent: true }));
    });
    check('no console errors after loading everything', errors.length === 0, errors.join(' | '));

    await browser.close();
    server.close();

    console.log(`\n${passed}/${passed + failed} UI checks passed${failed ? `, ${failed} FAILED` : ''}`);
    console.log(`Screenshots in ${path.relative(ROOT, SHOTS)}/\n`);
    process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
    console.error(err);
    process.exit(1);
});
