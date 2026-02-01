/**
 * ASCII Art Animations for SiteRead
 * Creates subtle, artistic ASCII-based animations
 */

// ASCII characters for different effects
const ASCII_CHARS = {
    light: ['·', ':', '.', ' '],
    medium: ['░', '▒', '▓', '█'],
    blocks: ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼'],
    dots: ['⠂', '⠃', '⠅', '⠆', '⠇', '⠋', '⠛', '⠿'],
    scan: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁']
};

// Typewriter effect
function typewriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    element.style.visibility = 'visible';

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Animated ASCII border that draws itself
function drawAsciiBox(element, delay = 30) {
    const content = element.dataset.content || element.textContent;
    const width = Math.max(content.length + 4, 40);

    const top = '╔' + '═'.repeat(width - 2) + '╗';
    const middle = '║ ' + content.padEnd(width - 4) + ' ║';
    const bottom = '╚' + '═'.repeat(width - 2) + '╝';

    const fullBox = [top, middle, bottom];
    let charIndex = 0;
    let lineIndex = 0;

    element.textContent = '';
    element.style.fontFamily = 'monospace';
    element.style.whiteSpace = 'pre';

    function draw() {
        if (lineIndex < fullBox.length) {
            const line = fullBox[lineIndex];
            if (charIndex < line.length) {
                element.textContent = fullBox.slice(0, lineIndex).join('\n') +
                    (lineIndex > 0 ? '\n' : '') +
                    line.substring(0, charIndex + 1);
                charIndex++;
                setTimeout(draw, delay);
            } else {
                charIndex = 0;
                lineIndex++;
                setTimeout(draw, delay);
            }
        }
    }
    draw();
}

// Animated background grid with subtle movement
class AsciiGrid {
    constructor(container, options = {}) {
        this.container = container;
        this.chars = options.chars || ASCII_CHARS.light;
        this.cols = options.cols || 60;
        this.rows = options.rows || 15;
        this.speed = options.speed || 100;
        this.grid = [];
        this.element = null;
        this.animationId = null;
        this.init();
    }

    init() {
        this.element = document.createElement('pre');
        this.element.className = 'ascii-grid';
        this.element.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.2;
      overflow: hidden;
      color: rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

        // Initialize grid
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = this.randomChar();
            }
        }

        this.container.appendChild(this.element);
        this.render();
        this.animate();
    }

    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }

    render() {
        this.element.textContent = this.grid.map(row => row.join('')).join('\n');
    }

    animate() {
        // Randomly change a few characters
        const changes = Math.floor(this.cols * this.rows * 0.02);
        for (let i = 0; i < changes; i++) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            this.grid[y][x] = this.randomChar();
        }
        this.render();
        this.animationId = setTimeout(() => this.animate(), this.speed);
    }

    destroy() {
        if (this.animationId) clearTimeout(this.animationId);
        if (this.element) this.element.remove();
    }
}

// Scanning line animation
class ScanLine {
    constructor(container) {
        this.container = container;
        this.element = document.createElement('div');
        this.element.className = 'scan-line';
        this.element.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.5), transparent);
      pointer-events: none;
      z-index: 10;
    `;
        this.container.appendChild(this.element);
        this.animate();
    }

    animate() {
        const height = this.container.offsetHeight;
        let pos = 0;

        const move = () => {
            pos += 2;
            if (pos > height) pos = 0;
            this.element.style.top = pos + 'px';
            requestAnimationFrame(move);
        };
        move();
    }
}

// ASCII art frames
const ASCII_FRAMES = {
    document: `
    ┌─────────────────┐
    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓   │
    │                 │
    │ ░░░░░░░░░░░░░░░ │
    │ ░░░░░░░░░░░     │
    │ ░░░░░░░░░░░░░   │
    │                 │
    │ ░░░░░░░░░░░░░░░ │
    │ ░░░░░░░░░       │
    └─────────────────┘
  `,
    alert: `
    ╔═══════════════════╗
    ║    ⚠ ALERT ⚠      ║
    ║    Cost Trap      ║
    ║    Detected       ║
    ╚═══════════════════╝
  `,
    check: `
    ┌───────────┐
    │     ✓     │
    │  Verified │
    └───────────┘
  `,
    logo: `
╭────────────────────────────────────────────────────────────╮
│                                                            │
│   ███████╗██╗████████╗███████╗██████╗ ███████╗ █████╗ ██████╗  │
│   ██╔════╝██║╚══██╔══╝██╔════╝██╔══██╗██╔════╝██╔══██╗██╔══██╗ │
│   ███████╗██║   ██║   █████╗  ██████╔╝█████╗  ███████║██║  ██║ │
│   ╚════██║██║   ██║   ██╔══╝  ██╔══██╗██╔══╝  ██╔══██║██║  ██║ │
│   ███████║██║   ██║   ███████╗██║  ██║███████╗██║  ██║██████╔╝ │
│   ╚══════╝╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  │
│                                                            │
╰────────────────────────────────────────────────────────────╯`,
    scanLine: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁'],
    loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    progress: ['○', '◔', '◑', '◕', '●']
};

// Wave animation for ASCII grids
function createWaveAnimation(container, options = {}) {
    const chars = options.chars || ASCII_CHARS.light;
    const speed = options.speed || 50;
    const amplitude = options.amplitude || 10;
    const frequency = options.frequency || 0.1;
    
    let phase = 0;
    const spans = container.querySelectorAll('span');
    
    function animate() {
        phase += 0.05;
        spans.forEach((span, i) => {
            const x = i % 60;
            const y = Math.floor(i / 60);
            const wave = Math.sin(x * frequency + phase) * Math.cos(y * frequency * 0.5 + phase);
            const opacity = 0.3 + (wave * 0.2);
            span.style.opacity = Math.max(0.1, Math.min(0.5, opacity));
        });
        requestAnimationFrame(animate);
    }
    
    animate();
}

// Floating code snippets
function createFloatingCode(container, options = {}) {
    const snippets = [
        'SCANNING...',
        'DETECTED',
        'ANALYZING',
        'PROCESSING',
        'EXTRACTING',
        'VERIFIED'
    ];
    
    const colors = ['#ea580c', '#0d9488', '#f59e0b'];
    
    function spawnSnippet() {
        const snippet = document.createElement('div');
        const text = snippets[Math.floor(Math.random() * snippets.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        snippet.textContent = text;
        snippet.style.cssText = `
            position: absolute;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: ${color};
            opacity: 0;
            pointer-events: none;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            transition: all 3s ease-out;
        `;
        
        container.appendChild(snippet);
        
        // Animate
        setTimeout(() => {
            snippet.style.opacity = '0.3';
            snippet.style.transform = `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)`;
        }, 100);
        
        // Remove after animation
        setTimeout(() => {
            snippet.style.opacity = '0';
            setTimeout(() => snippet.remove(), 1000);
        }, 2500);
    }
    
    // Spawn periodically
    setInterval(spawnSnippet, options.interval || 2000);
}

// Mouse-reactive ASCII
function createReactiveAscii(container) {
    const chars = ['·', ':', '∙', '°', '•'];
    const grid = document.createElement('div');
    grid.className = 'reactive-ascii';
    grid.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    font-family: monospace;
    font-size: 10px;
    line-height: 1;
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(auto-fill, 10px);
    opacity: 0.15;
  `;

    // Fill grid
    const cellCount = 2000;
    for (let i = 0; i < cellCount; i++) {
        const span = document.createElement('span');
        span.textContent = chars[Math.floor(Math.random() * chars.length)];
        span.style.transition = 'opacity 0.3s, transform 0.3s';
        grid.appendChild(span);
    }

    container.appendChild(grid);

    // React to mouse
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        grid.querySelectorAll('span').forEach((span, i) => {
            const spanRect = span.getBoundingClientRect();
            const spanX = spanRect.left - rect.left;
            const spanY = spanRect.top - rect.top;
            const dist = Math.sqrt(Math.pow(x - spanX, 2) + Math.pow(y - spanY, 2));

            if (dist < 100) {
                span.style.opacity = '1';
                span.style.transform = 'scale(1.5)';
            } else {
                span.style.opacity = '';
                span.style.transform = '';
            }
        });
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Typewriter effects
    document.querySelectorAll('[data-typewriter]').forEach(el => {
        const text = el.dataset.typewriter || el.textContent;
        const speed = parseInt(el.dataset.speed) || 50;
        el.textContent = '';

        // Start after a delay
        setTimeout(() => typewriter(el, text, speed), 500);
    });

    // ASCII boxes
    document.querySelectorAll('[data-ascii-box]').forEach(el => {
        drawAsciiBox(el);
    });

    // ASCII grids
    document.querySelectorAll('[data-ascii-grid]').forEach(el => {
        new AsciiGrid(el, {
            chars: ASCII_CHARS.light,
            speed: 150
        });
    });

    // Reactive ASCII
    document.querySelectorAll('[data-reactive-ascii]').forEach(el => {
        createReactiveAscii(el);
    });
});

// Export for manual use
window.SiteReadAscii = {
    typewriter,
    drawAsciiBox,
    AsciiGrid,
    ScanLine,
    createReactiveAscii,
    createWaveAnimation,
    createFloatingCode,
    ASCII_CHARS,
    ASCII_FRAMES
};
