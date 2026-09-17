/**
 * Small shared helpers.
 */

/**
 * Escape text that is about to be interpolated into innerHTML.
 *
 * State names, transition labels and input strings are all author-controlled -
 * a state called <img onerror=...> would otherwise execute when its chip is
 * rendered. Everything machine-authored goes through here or through
 * textContent.
 */
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Element factory: el('div', { class: 'x' }, 'text' | [children]). */
function el(tag, attrs = {}, children = null) {
    const node = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value);
    });

    if (typeof children === 'string') node.textContent = children;
    else if (Array.isArray(children)) children.forEach(c => c && node.appendChild(c));
    else if (children) node.appendChild(children);

    return node;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, el };
}
