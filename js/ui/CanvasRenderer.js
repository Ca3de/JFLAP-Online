/**
 * CanvasRenderer - draws automata on a HiDPI canvas.
 *
 * All geometry is computed in world coordinates and converted to canvas
 * coordinates at draw time. Colours come from CSS custom properties so the
 * diagram follows the page theme; call refreshTheme() after a theme change.
 */
class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dpr = 1;

        // Logical (CSS pixel) size of the canvas
        this.width = 0;
        this.height = 0;

        // State appearance
        this.stateRadius = 30;
        this.finalRingOffset = 5;
        this.initialArrowLength = 34;

        // Edge appearance
        this.arrowSize = 9;

        /** Perpendicular offset given to an edge that has a twin running the
         *  other way. Both directions get the SAME signed value: an edge's
         *  perpendicular flips when it runs backwards, so the two bow apart. */
        this.opposingCurve = 34;
        /** Offset step between several edges sharing one ordered pair. */
        this.parallelCurve = 42;
        /** A state centre closer than radius + this to an edge blocks it. */
        this.clearance = 20;
        /** First bow magnitude tried when an edge has to dodge a state. */
        this.deflectStart = 58;
        /** Added per nesting depth so dodging edges do not land on each other. */
        this.deflectNest = 46;
        this.deflectStep = 22;
        this.deflectMax = 900;

        // Self-loops nest CONCENTRICALLY: each slot reaches much further while
        // the angular spread barely widens. Fanning them sideways instead puts
        // every label at the same height, where they collide.
        this.loopReach = 62;
        this.loopReachStep = 56;
        this.loopSpread = 0.42;
        this.loopSpreadStep = 0.05;
        this.loopSplay = 1.6;

        this.colors = {};
        this.refreshTheme();
        this.setupCanvas();
    }

    /* ---------------------------------------------------------------- theme */

    /**
     * Re-read the palette from CSS custom properties. The canvas cannot
     * inherit CSS, so the theme has to be pulled across explicitly.
     */
    refreshTheme() {
        const css = getComputedStyle(document.documentElement);
        const read = (name, fallback) => {
            const value = css.getPropertyValue(name);
            return value && value.trim() ? value.trim() : fallback;
        };

        this.colors = {
            background: read('--canvas-bg', '#ffffff'),
            grid: read('--canvas-grid', '#e2e8f0'),
            state: read('--canvas-state', '#f8fafc'),
            stateStroke: read('--canvas-state-stroke', '#64748b'),
            stateText: read('--canvas-state-text', '#0f172a'),
            initialArrow: read('--canvas-initial', '#10b981'),
            finalRing: read('--canvas-final-ring', '#64748b'),
            activeState: read('--canvas-active', '#6366f1'),
            activeStateText: read('--canvas-active-text', '#ffffff'),
            selectedState: read('--canvas-selected', '#0ea5e9'),
            transition: read('--canvas-edge', '#94a3b8'),
            transitionText: read('--canvas-edge-text', '#475569'),
            highlightedTransition: read('--canvas-edge-active', '#6366f1'),
            selectedTransition: read('--canvas-edge-selected', '#0ea5e9'),
            preview: read('--canvas-preview', '#6366f1')
        };
    }

    /* --------------------------------------------------------------- canvas */

    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Size the backing store for the device pixel ratio so strokes and text
     * stay crisp on HiDPI displays.
     */
    resize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.width = Math.max(1, Math.round(rect.width));
        this.height = Math.max(1, Math.round(rect.height));
        this.dpr = dpr;

        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    clear() {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.drawGrid();
    }

    /** Dot grid - lighter than a line grid and does not compete with edges. */
    drawGrid() {
        const spacing = 24 * this.scale;
        if (spacing < 8) return;

        const radius = Math.min(1.4, Math.max(0.6, 1.1 * this.scale));
        const startX = ((this.offsetX * this.scale) % spacing + spacing) % spacing;
        const startY = ((this.offsetY * this.scale) % spacing + spacing) % spacing;

        this.ctx.fillStyle = this.colors.grid;
        for (let x = startX; x < this.width; x += spacing) {
            for (let y = startY; y < this.height; y += spacing) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    toCanvasCoords(x, y) {
        return {
            x: (x + this.offsetX) * this.scale,
            y: (y + this.offsetY) * this.scale
        };
    }

    toWorldCoords(x, y) {
        return {
            x: x / this.scale - this.offsetX,
            y: y / this.scale - this.offsetY
        };
    }

    /* ----------------------------------------------------------- edge layout */

    static sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

    static norm(v) {
        const len = Math.hypot(v.x, v.y) || 1;
        return { x: v.x / len, y: v.y / len };
    }

    /** Point on a quadratic Bezier. */
    static quad(p0, c, p1, t) {
        const u = 1 - t;
        return {
            x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
            y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
        };
    }

    /** Point on a cubic Bezier. */
    static cubic(p0, c1, c2, p3, t) {
        const u = 1 - t;
        return {
            x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
            y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y
        };
    }

    /**
     * Build the quadratic for one edge given a signed perpendicular offset.
     * Endpoints sit on the state circles facing the control point, so a bowed
     * edge leaves and enters its states along the curve rather than the chord.
     */
    arcGeometry(fromState, toState, k) {
        const p0 = { x: fromState.x, y: fromState.y };
        const p1 = { x: toState.x, y: toState.y };
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const perp = { x: -dy / len, y: dx / len };
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const control = { x: mid.x + perp.x * k, y: mid.y + perp.y * k };

        const r = this.stateRadius;
        const outDir = CanvasRenderer.norm(CanvasRenderer.sub(control, p0));
        const inDir = CanvasRenderer.norm(CanvasRenderer.sub(control, p1));
        const start = { x: p0.x + outDir.x * r, y: p0.y + outDir.y * r };
        const end = { x: p1.x + inDir.x * r, y: p1.y + inDir.y * r };

        return {
            type: 'arc',
            k,
            perp,
            start,
            end,
            control,
            // Midpoint of the drawn curve, used for the label.
            mid: {
                x: (start.x + 2 * control.x + end.x) / 4,
                y: (start.y + 2 * control.y + end.y) / 4
            }
        };
    }

    /** True if the curve passes too close to the centre of any other state. */
    isBlocked(geom, states, fromId, toId) {
        const limit = this.stateRadius + this.clearance;
        const steps = 28;

        for (const state of states) {
            if (state.id === fromId || state.id === toId) continue;
            for (let i = 0; i <= steps; i++) {
                const p = CanvasRenderer.quad(geom.start, geom.control, geom.end, i / steps);
                if (Math.hypot(p.x - state.x, p.y - state.y) < limit) return true;
            }
        }
        return false;
    }

    /** Geometry of one self-loop, nested by slot. */
    loopGeometry(state, slot) {
        const r = this.stateRadius;
        const reach = this.loopReach + this.loopReachStep * slot;
        const spread = this.loopSpread + this.loopSpreadStep * slot;
        const up = -Math.PI / 2;

        // Anchors on the state circle, and control points splayed further from
        // vertical at distance r + reach.
        const aRight = up + spread;
        const aLeft = up - spread;
        const cRight = up + spread * this.loopSplay;
        const cLeft = up - spread * this.loopSplay;

        const p0 = { x: state.x + r * Math.cos(aRight), y: state.y + r * Math.sin(aRight) };
        const p3 = { x: state.x + r * Math.cos(aLeft), y: state.y + r * Math.sin(aLeft) };
        const c1 = {
            x: state.x + (r + reach) * Math.cos(cRight),
            y: state.y + (r + reach) * Math.sin(cRight)
        };
        const c2 = {
            x: state.x + (r + reach) * Math.cos(cLeft),
            y: state.y + (r + reach) * Math.sin(cLeft)
        };

        // The COMPUTED apex, B(0.5) = (p0 + 3c1 + 3c2 + p3) / 8. The control
        // points splay away from vertical and so reach far less far along it
        // than r + reach suggests; an approximation floats the label clear of
        // the curve it is meant to sit on.
        const apex = {
            x: (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8,
            y: (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8
        };

        return { type: 'loop', p0, c1, c2, p3, apex, reach, slot };
    }

    /**
     * Compute the drawing geometry for every transition of an automaton.
     * Cached per render; callers (hit-testing, fit-to-view) can ask for it.
     */
    layout(automaton) {
        const geoms = new Map();
        if (!automaton) return geoms;

        const stateOf = (ref) => (typeof ref === 'object' && ref !== null)
            ? ref
            : automaton.getState(ref);

        const loopSlots = new Map();
        const pairSlots = new Map();
        const pairCounts = new Map();
        const directed = new Set();

        automaton.transitions.forEach(t => {
            const from = stateOf(t.fromState);
            const to = stateOf(t.toState);
            if (!from || !to || from.id === to.id) return;
            const key = `${from.id}->${to.id}`;
            directed.add(key);
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        });

        const arcs = [];

        automaton.transitions.forEach(t => {
            const from = stateOf(t.fromState);
            const to = stateOf(t.toState);
            if (!from || !to) return;

            if (from.id === to.id) {
                const slot = loopSlots.get(from.id) || 0;
                loopSlots.set(from.id, slot + 1);
                geoms.set(t.id, this.loopGeometry(from, slot));
                return;
            }

            const key = `${from.id}->${to.id}`;
            const slot = pairSlots.get(key) || 0;
            pairSlots.set(key, slot + 1);
            const count = pairCounts.get(key) || 1;
            const hasReverse = directed.has(`${to.id}->${from.id}`);

            let k;
            if (hasReverse) {
                // Same signed offset for both directions - the perpendicular
                // flips with the direction, so they separate on their own.
                k = this.opposingCurve + slot * this.parallelCurve;
            } else {
                k = (slot - (count - 1) / 2) * this.parallelCurve;
            }

            arcs.push({ transition: t, from, to, k });
        });

        // Dodging pass: shortest spans first, so a long edge sees the short
        // ones already parked below it and nests outside them.
        arcs.sort((a, b) =>
            Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) -
            Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y));

        const parked = [];

        arcs.forEach(arc => {
            let geom = this.arcGeometry(arc.from, arc.to, arc.k);

            if (this.isBlocked(geom, automaton.states, arc.from.id, arc.to.id)) {
                const dx = arc.to.x - arc.from.x;
                const dy = arc.to.y - arc.from.y;
                // Bow DOWNWARD on screen: self-loops own the space above a
                // state. Positive k bows toward (-dy, dx), whose y component
                // is dx/len, so matching the sign of dx sends the bow down.
                let sign;
                if (Math.abs(dx) > 1e-6) sign = Math.sign(dx);
                else sign = dy >= 0 ? 1 : -1;

                const minX = Math.min(arc.from.x, arc.to.x);
                const maxX = Math.max(arc.from.x, arc.to.x);
                const depth = parked.filter(p => p.minX < maxX && p.maxX > minX).length;

                let magnitude = this.deflectStart + depth * this.deflectNest;
                geom = this.arcGeometry(arc.from, arc.to, sign * magnitude);
                while (this.isBlocked(geom, automaton.states, arc.from.id, arc.to.id) &&
                       magnitude < this.deflectMax) {
                    magnitude += this.deflectStep;
                    geom = this.arcGeometry(arc.from, arc.to, sign * magnitude);
                }

                parked.push({ minX, maxX });
            }

            geoms.set(arc.transition.id, geom);
        });

        return geoms;
    }

    /* --------------------------------------------------------------- drawing */

    render(automaton) {
        this.clear();
        if (!automaton) return;

        this.geoms = this.layout(automaton);
        this.placeLabels(automaton);

        automaton.transitions.forEach(t => this.drawTransition(t, automaton));
        automaton.states.forEach(s => this.drawState(s));
    }

    /** Where an edge label wants to sit, before collisions are considered. */
    labelAnchor(geom) {
        if (geom.type === 'loop') {
            return { x: geom.apex.x, y: geom.apex.y - 9 };
        }
        const nudge = Math.abs(geom.k) < 0.01 ? 13 : 11 * Math.sign(geom.k);
        return {
            x: geom.mid.x + geom.perp.x * nudge,
            y: geom.mid.y + geom.perp.y * nudge
        };
    }

    /**
     * Nudge edge labels apart where they would land on each other. Two edges
     * can be perfectly routed and still be unreadable if their labels overlap,
     * which happens as soon as a deflected edge apexes near another edge.
     * Labels move along the direction that takes them away from their own
     * curve, so each stays attached to the edge it belongs to.
     */
    placeLabels(automaton) {
        const ctx = this.ctx;
        const size = 12;                      // world units at scale 1
        const height = size * 1.5;
        ctx.font = `${size}px 'JetBrains Mono', ui-monospace, monospace`;

        const placed = [];
        const overlaps = (a, b) =>
            Math.abs(a.x - b.x) * 2 < (a.w + b.w) + 6 &&
            Math.abs(a.y - b.y) * 2 < (a.h + b.h) + 2;

        automaton.transitions.forEach(t => {
            const geom = this.geoms.get(t.id);
            if (!geom) return;

            const label = t.getLabel(automaton.type);
            if (!label) { geom.label = null; return; }

            const anchor = this.labelAnchor(geom);
            const width = ctx.measureText(label).width;

            // Away from the curve: loops push up, arcs push along their bow.
            let push;
            if (geom.type === 'loop') {
                push = { x: 0, y: -1 };
            } else if (Math.abs(geom.k) < 0.01) {
                push = { x: geom.perp.x, y: geom.perp.y };
            } else {
                push = {
                    x: geom.perp.x * Math.sign(geom.k),
                    y: geom.perp.y * Math.sign(geom.k)
                };
            }

            let box = { x: anchor.x, y: anchor.y, w: width, h: height };
            for (let attempt = 0; attempt < 8; attempt++) {
                if (!placed.some(p => overlaps(box, p))) break;
                box = {
                    x: box.x + push.x * (height + 3),
                    y: box.y + push.y * (height + 3),
                    w: width,
                    h: height
                };
            }

            placed.push(box);
            geom.label = { x: box.x, y: box.y };
        });
    }

    drawState(state) {
        const pos = this.toCanvasCoords(state.x, state.y);
        const radius = this.stateRadius * this.scale;
        const ctx = this.ctx;

        let fillColor = this.colors.state;
        let strokeColor = this.colors.stateStroke;
        let textColor = this.colors.stateText;
        let lineWidth = 1.75;

        if (state.active) {
            fillColor = this.colors.activeState;
            strokeColor = this.colors.activeState;
            textColor = this.colors.activeStateText;
            lineWidth = 2;
        } else if (state.selected) {
            strokeColor = this.colors.selectedState;
            lineWidth = 2.5;
        }

        if (state.isInitial) {
            this.drawInitialArrow(pos.x, pos.y, radius);
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth * this.scale;
        ctx.stroke();

        if (state.isFinal) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius - this.finalRingOffset * this.scale, 0, Math.PI * 2);
            ctx.strokeStyle = state.active ? this.colors.activeStateText : this.colors.finalRing;
            ctx.lineWidth = 1.5 * this.scale;
            ctx.stroke();
        }

        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        this.drawFittedName(state.name, pos.x, pos.y, radius * 1.92);
    }

    /**
     * Draw a state name inside its circle, shrinking the type to fit before
     * resorting to an ellipsis. Names like "LOCKED" or "matchA" are the point
     * of the diagram; truncating them to "LOCK…" throws that away.
     */
    drawFittedName(name, x, y, maxWidth) {
        const label = String(name == null ? '' : name);
        const ctx = this.ctx;
        const base = 13 * this.scale;
        const floor = 9 * this.scale;

        let size = base;
        const font = (s) => `600 ${s}px Inter, system-ui, sans-serif`;
        ctx.font = font(size);

        while (ctx.measureText(label).width > maxWidth && size > floor) {
            size -= 0.5;
            ctx.font = font(size);
        }

        let text = label;
        while (text.length > 1 && ctx.measureText(text).width > maxWidth) {
            text = text.slice(0, -1);
            ctx.font = font(size);
            if (ctx.measureText(`${text}…`).width <= maxWidth) { text = `${text}…`; break; }
        }

        ctx.fillText(text, x, y);
    }

    drawInitialArrow(x, y, radius) {
        const length = this.initialArrowLength * this.scale;
        const endX = x - radius - 2 * this.scale;

        this.ctx.beginPath();
        this.ctx.moveTo(endX - length, y);
        this.ctx.lineTo(endX, y);
        this.ctx.strokeStyle = this.colors.initialArrow;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.stroke();
        this.drawArrowHead(endX, y, 0, this.colors.initialArrow);
    }

    drawArrowHead(x, y, angle, color) {
        const size = this.arrowSize * this.scale;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, -size * 0.45);
        ctx.lineTo(-size * 0.72, 0);
        ctx.lineTo(-size, size * 0.45);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    edgeColor(transition) {
        if (transition.highlighted) return this.colors.highlightedTransition;
        if (transition.selected) return this.colors.selectedTransition;
        return this.colors.transition;
    }

    drawTransition(transition, automaton) {
        const geom = this.geoms ? this.geoms.get(transition.id) : null;
        if (!geom) return;

        const color = this.edgeColor(transition);
        const label = transition.getLabel(automaton.type);
        const emphasised = transition.highlighted || transition.selected;

        if (geom.type === 'loop') {
            this.drawLoop(geom, color, label, emphasised);
        } else {
            this.drawArc(geom, color, label, emphasised);
        }
    }

    drawLoop(geom, color, label, emphasised) {
        const ctx = this.ctx;
        const p0 = this.toCanvasCoords(geom.p0.x, geom.p0.y);
        const c1 = this.toCanvasCoords(geom.c1.x, geom.c1.y);
        const c2 = this.toCanvasCoords(geom.c2.x, geom.c2.y);
        const p3 = this.toCanvasCoords(geom.p3.x, geom.p3.y);

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = (emphasised ? 2.6 : 1.8) * this.scale;
        ctx.stroke();

        const angle = Math.atan2(p3.y - c2.y, p3.x - c2.x);
        this.drawArrowHead(p3.x, p3.y, angle, color);

        // Label sits on the COMPUTED apex of the curve, (p0+3c1+3c2+p3)/8.
        if (geom.label) {
            const pos = this.toCanvasCoords(geom.label.x, geom.label.y);
            this.drawEdgeLabel(label, pos.x, pos.y, color, emphasised);
        }
    }

    drawArc(geom, color, label, emphasised) {
        const ctx = this.ctx;
        const start = this.toCanvasCoords(geom.start.x, geom.start.y);
        const end = this.toCanvasCoords(geom.end.x, geom.end.y);
        const control = this.toCanvasCoords(geom.control.x, geom.control.y);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        if (Math.abs(geom.k) < 0.01) {
            ctx.lineTo(end.x, end.y);
        } else {
            ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = (emphasised ? 2.6 : 1.8) * this.scale;
        ctx.stroke();

        // Tangent at t = 1 points along (end - control).
        const angle = Math.abs(geom.k) < 0.01
            ? Math.atan2(end.y - start.y, end.x - start.x)
            : Math.atan2(end.y - control.y, end.x - control.x);
        this.drawArrowHead(end.x, end.y, angle, color);

        if (geom.label) {
            const pos = this.toCanvasCoords(geom.label.x, geom.label.y);
            this.drawEdgeLabel(label, pos.x, pos.y, color, emphasised);
        }
    }

    /** Edge label with a background chip so it stays readable over the grid. */
    drawEdgeLabel(label, x, y, color, emphasised) {
        if (!label) return;
        const ctx = this.ctx;
        const size = Math.max(8, 12 * this.scale);
        ctx.font = `${emphasised ? '600 ' : ''}${size}px 'JetBrains Mono', ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const width = ctx.measureText(label).width;
        ctx.fillStyle = this.colors.background;
        ctx.globalAlpha = 0.88;
        ctx.fillRect(x - width / 2 - 3 * this.scale, y - size * 0.72,
                     width + 6 * this.scale, size * 1.44);
        ctx.globalAlpha = 1;

        ctx.fillStyle = emphasised ? color : this.colors.transitionText;
        ctx.fillText(label, x, y);
    }

    /* ---------------------------------------------------------- hit testing */

    /** Shortest distance (world units) from a point to a transition's curve. */
    distanceToTransition(x, y, transition, automaton) {
        let geom = this.geoms ? this.geoms.get(transition.id) : null;
        if (!geom) {
            const layout = this.layout(automaton);
            geom = layout.get(transition.id);
        }
        if (!geom) return Infinity;

        const steps = 40;
        let best = Infinity;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = geom.type === 'loop'
                ? CanvasRenderer.cubic(geom.p0, geom.c1, geom.c2, geom.p3, t)
                : CanvasRenderer.quad(geom.start, geom.control, geom.end, t);
            best = Math.min(best, Math.hypot(p.x - x, p.y - y));
        }
        return best;
    }

    /* ---------------------------------------------------------------- extras */

    drawSelectionBox(startX, startY, endX, endY) {
        const start = this.toCanvasCoords(startX, startY);
        const end = this.toCanvasCoords(endX, endY);
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);

        this.ctx.strokeStyle = this.colors.selectedState;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(x, y, w, h);
        this.ctx.setLineDash([]);

        this.ctx.save();
        this.ctx.globalAlpha = 0.12;
        this.ctx.fillStyle = this.colors.selectedState;
        this.ctx.fillRect(x, y, w, h);
        this.ctx.restore();
    }

    drawTransitionPreview(fromState, toX, toY) {
        const from = this.toCanvasCoords(fromState.x, fromState.y);
        const to = this.toCanvasCoords(toX, toY);
        const radius = this.stateRadius * this.scale;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        this.ctx.beginPath();
        this.ctx.moveTo(from.x + radius * Math.cos(angle), from.y + radius * Math.sin(angle));
        this.ctx.lineTo(to.x, to.y);
        this.ctx.strokeStyle = this.colors.preview;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.setLineDash([5, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.drawArrowHead(to.x, to.y, angle, this.colors.preview);
    }

    /* ------------------------------------------------------------- viewport */

    setZoom(scale) {
        this.scale = Math.max(0.25, Math.min(3, scale));
    }

    /** Zoom keeping the world point under (canvasX, canvasY) fixed. */
    zoomAt(factor, canvasX, canvasY) {
        const before = this.toWorldCoords(canvasX, canvasY);
        this.setZoom(this.scale * factor);
        const after = this.toWorldCoords(canvasX, canvasY);
        this.offsetX += after.x - before.x;
        this.offsetY += after.y - before.y;
    }

    pan(dx, dy) {
        this.offsetX += dx / this.scale;
        this.offsetY += dy / this.scale;
    }

    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * World-space bounding box of everything drawn, including the bow of
     * deflected edges and the reach of self-loops - leaving those out clips
     * exactly the arcs that fit-to-view exists to reveal.
     */
    getBounds(automaton) {
        if (!automaton || automaton.states.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const include = (x, y, pad = 0) => {
            minX = Math.min(minX, x - pad);
            minY = Math.min(minY, y - pad);
            maxX = Math.max(maxX, x + pad);
            maxY = Math.max(maxY, y + pad);
        };

        automaton.states.forEach(s => {
            include(s.x, s.y, this.stateRadius + 6);
            if (s.isInitial) include(s.x - this.stateRadius - this.initialArrowLength - 6, s.y);
        });

        const layout = this.layout(automaton);
        layout.forEach(geom => {
            if (geom.type === 'loop') {
                // Sample the loop rather than trusting its control points,
                // which overshoot the drawn curve considerably.
                for (let i = 0; i <= 12; i++) {
                    const p = CanvasRenderer.cubic(geom.p0, geom.c1, geom.c2, geom.p3, i / 12);
                    include(p.x, p.y, 4);
                }
                include(geom.apex.x, geom.apex.y - 16, 6);
            } else {
                for (let i = 0; i <= 12; i++) {
                    const p = CanvasRenderer.quad(geom.start, geom.control, geom.end, i / 12);
                    include(p.x, p.y, 4);
                }
            }
            // Labels can sit outside the curve once they have been nudged.
            const anchor = geom.label || this.labelAnchor(geom);
            include(anchor.x, anchor.y, 14);
        });

        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }

    /** Scale and centre the view so the whole automaton is visible. */
    fitToView(automaton, padding = 48) {
        const bounds = this.getBounds(automaton);
        if (!bounds) {
            this.resetView();
            return;
        }

        const availableW = Math.max(40, this.width - padding * 2);
        const availableH = Math.max(40, this.height - padding * 2);
        const scale = Math.min(
            availableW / Math.max(bounds.width, 1),
            availableH / Math.max(bounds.height, 1)
        );

        this.setZoom(Math.min(scale, 1.4));
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        this.offsetX = this.width / (2 * this.scale) - centerX;
        this.offsetY = this.height / (2 * this.scale) - centerY;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasRenderer;
}
