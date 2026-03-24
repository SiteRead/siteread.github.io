/**
 * Specular Band — Ported from Motion Core's SpecularBand Svelte component
 * Uses the exact same GLSL shader, adapted for vanilla Three.js
 */
class SpecularBand {
    constructor(container, opts = {}) {
        this.el = container;
        this.o = {
            color: opts.color || '#FF6900',
            backgroundColor: opts.backgroundColor || '#000000',
            speed: opts.speed ?? 1.0,
            distortion: opts.distortion ?? 0.2,
            hueShift: opts.hueShift ?? 30.0,
            intensity: opts.intensity ?? 1.0
        };
        this.raf = null;
        this.clock = { elapsed: 0, last: performance.now() };

        if (!window.THREE || !this._gl()) { this._fallback(); return; }
        this._setup();
        this._loop();
        this._onResize = () => {
            const w = this.el.clientWidth, h = this.el.clientHeight;
            this.renderer.setSize(w, h);
            this.mat.uniforms.uResolution.value.set(w, h);
        };
        window.addEventListener('resize', this._onResize);
    }

    _gl() {
        try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
        catch { return false; }
    }

    _fallback() {
        this.el.style.background = 'radial-gradient(ellipse at 50% 45%, rgba(234,88,12,0.12) 0%, rgba(45,212,191,0.04) 40%, #050505 70%)';
    }

    _setup() {
        const w = this.el.clientWidth, h = this.el.clientHeight;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
        this.el.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const col = new THREE.Color(this.o.color);
        const bg = new THREE.Color(this.o.backgroundColor);

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(w, h) },
                uColor: { value: col },
                uBackgroundColor: { value: bg },
                uSpeed: { value: this.o.speed },
                uDistortion: { value: this.o.distortion },
                uHueShift: { value: this.o.hueShift },
                uIntensity: { value: this.o.intensity },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;

                uniform float uTime;
                uniform vec2 uResolution;
                uniform vec3 uColor;
                uniform vec3 uBackgroundColor;
                uniform float uSpeed;
                uniform float uDistortion;
                uniform float uHueShift;
                uniform float uIntensity;

                mat3 hueRot(float a) {
                    float c = cos(a), s = sin(a), t = 1.0 - c;
                    return mat3(
                        t*.333+c,      t*.333-s*.577, t*.333+s*.577,
                        t*.333+s*.577, t*.333+c,      t*.333-s*.577,
                        t*.333-s*.577, t*.333+s*.577, t*.333+c
                    );
                }

                float colorLuma(vec3 c) {
                    return dot(c, vec3(0.2126, 0.7152, 0.0722));
                }

                vec3 hueFromColor(vec3 c, vec3 fallback) {
                    float m = max(max(c.r, c.g), c.b);
                    if (m < 1e-5) return fallback;
                    return clamp(c / m, 0.0, 1.0);
                }

                vec3 blendAdaptive(vec3 bg, vec3 effect, float softness) {
                    float bgLum = colorLuma(bg);
                    float lightBg = smoothstep(0.45, 0.95, bgLum);
                    float edge = clamp(softness, 0.0, 1.0);

                    vec3 additive = bg + effect;
                    vec3 effectHue = hueFromColor(effect, vec3(1.0));
                    vec3 tintTarget = mix(bg, effectHue, 0.9);
                    vec3 tint = mix(bg, tintTarget, edge);

                    return mix(additive, tint, lightBg);
                }

                void mainImage(out vec4 o, vec2 uv) {
                    vec2 u = (uv * 2.0 - 1.0);
                    u.x *= uResolution.x / uResolution.y;

                    float time = uTime * uSpeed;

                    u /= 0.5 + uDistortion * dot(u, u);
                    u += 0.2 * cos(time) - 7.56;

                    vec3 baseColor = uColor;

                    vec3 palette[3];
                    palette[0] = baseColor;
                    palette[1] = hueRot(radians(uHueShift)) * baseColor;
                    palette[2] = hueRot(radians(-uHueShift)) * baseColor;

                    vec3 col = vec3(0.0);
                    float edgeField = 0.0;
                    for(int i = 0; i < 3; i++) {
                        vec2 uv_loop = sin(1.5 * u.yx + 2.0 * cos(u -= 0.01));
                        float val = 1.0 - exp(-6.0 / exp(6.0 * length(uv_loop + sin(5.0 * uv_loop.y - 3.0 * time) / 4.0)));
                        val = pow(clamp(val, 0.0, 1.0), 1.4);
                        edgeField += val;
                        col += val * palette[i];
                    }
                    vec3 bands = col * uIntensity;
                    float softMask = 1.0 - exp(-0.85 * edgeField * uIntensity);
                    vec3 rgb = blendAdaptive(uBackgroundColor, bands, softMask);
                    o = vec4(rgb, 1.0);
                }

                void main() {
                    vec4 fragColor;
                    mainImage(fragColor, vUv);
                    gl_FragColor = fragColor;
                }
            `,
            depthTest: false,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
        this.scene.add(this.mesh);
    }

    _loop() {
        if (!document.hidden) {
            const now = performance.now();
            const delta = (now - this.clock.last) / 1000;
            this.clock.last = now;
            this.clock.elapsed += delta;
            this.mat.uniforms.uTime.value = this.clock.elapsed;
            this.renderer.render(this.scene, this.cam);
        } else {
            this.clock.last = performance.now();
        }
        this.raf = requestAnimationFrame(() => this._loop());
    }

    destroy() {
        if (this.raf) cancelAnimationFrame(this.raf);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        if (this.renderer) {
            this.mesh.geometry.dispose();
            this.mat.dispose();
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }
    }
}

window.SpecularBand = SpecularBand;
