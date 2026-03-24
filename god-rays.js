/**
 * God Rays — Ported from Motion Core's GodRays Svelte component
 * Atmospheric scattering with rotating camera, exact same GLSL shader
 */
class GodRays {
    constructor(container, opts = {}) {
        this.el = container;
        this.o = {
            rotationSpeed: opts.rotationSpeed ?? 0.5,
            backgroundColor: opts.backgroundColor || '#000000',
            cameraDistance: opts.cameraDistance ?? 3.0,
            fov: opts.fov ?? 55.0,
            sunX: opts.sunX ?? 0.0,
            sunY: opts.sunY ?? 0.0,
            sunZ: opts.sunZ ?? 1.0,
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
        this.el.style.background = 'radial-gradient(ellipse at 50% 50%, rgba(234,88,12,0.08) 0%, #000 70%)';
    }

    _setup() {
        const w = this.el.clientWidth, h = this.el.clientHeight;
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
        this.el.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const bg = new THREE.Color(this.o.backgroundColor);
        const sunDir = new THREE.Vector3(this.o.sunX, this.o.sunY, this.o.sunZ).normalize();

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(w, h) },
                uBackgroundColor: { value: bg },
                uRotationSpeed: { value: this.o.rotationSpeed },
                uCameraDistance: { value: this.o.cameraDistance },
                uFov: { value: this.o.fov },
                uSunDir: { value: sunDir },
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
                uniform vec3 uBackgroundColor;
                uniform float uRotationSpeed;
                uniform float uCameraDistance;
                uniform float uFov;
                uniform vec3 uSunDir;
                uniform float uIntensity;

                const float PI = 3.14159265359;
                const float MAX = 10000.0;
                const float R_INNER = 1.0;
                const float R = 1.5;
                const int NUM_OUT_SCATTER = 8;
                const int NUM_IN_SCATTER = 40;

                vec2 ray_vs_sphere(vec3 p, vec3 dir, float r) {
                    float b = dot(p, dir);
                    float c = dot(p, p) - r * r;
                    float d = b * b - c;
                    if (d < 0.0) return vec2(MAX, -MAX);
                    d = sqrt(d);
                    return vec2(-b - d, -b + d);
                }

                float phase_mie(float g, float c, float cc) {
                    float gg = g * g;
                    float a = (1.0 - gg) * (1.0 + cc);
                    float b = 1.0 + gg - 2.0 * g * c;
                    b *= sqrt(b);
                    b *= 2.0 + gg;
                    return (3.0 / 8.0 / PI) * a / b;
                }

                float phase_ray(float cc) {
                    return (3.0 / 16.0 / PI) * (1.0 + cc);
                }

                float density(vec3 p, float ph) {
                    return exp(-max(length(p) - R_INNER, 0.0) / ph);
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
                    vec3 tintTarget = mix(bg, effectHue, 0.85);
                    vec3 tint = mix(bg, tintTarget, edge);
                    return mix(additive, tint, lightBg);
                }

                float optic(vec3 p, vec3 q, float ph) {
                    vec3 s = (q - p) / float(NUM_OUT_SCATTER);
                    vec3 v = p + s * 0.5;
                    float sum = 0.0;
                    for (int i = 0; i < NUM_OUT_SCATTER; i++) {
                        sum += density(v, ph);
                        v += s;
                    }
                    sum *= length(s);
                    return sum;
                }

                vec3 in_scatter(vec3 o, vec3 dir, vec2 e, vec3 l) {
                    const float ph_ray = 0.05;
                    const float ph_mie = 0.02;
                    const vec3 k_ray = vec3(3.8, 13.5, 33.1);
                    const vec3 k_mie = vec3(21.0);
                    const float k_mie_ex = 1.1;

                    vec3 sum_ray = vec3(0.0);
                    vec3 sum_mie = vec3(0.0);
                    float n_ray0 = 0.0;
                    float n_mie0 = 0.0;
                    float len = (e.y - e.x) / float(NUM_IN_SCATTER);
                    vec3 s = dir * len;
                    vec3 v = o + dir * (e.x + len * 0.5);

                    for (int i = 0; i < NUM_IN_SCATTER; i++, v += s) {
                        float d_ray = density(v, ph_ray) * len;
                        float d_mie = density(v, ph_mie) * len;
                        n_ray0 += d_ray;
                        n_mie0 += d_mie;

                        vec2 f = ray_vs_sphere(v, l, R);
                        vec3 u = v + l * f.y;
                        float n_ray1 = optic(v, u, ph_ray);
                        float n_mie1 = optic(v, u, ph_mie);
                        vec3 att = exp(-(n_ray0 + n_ray1) * k_ray - (n_mie0 + n_mie1) * k_mie * k_mie_ex);
                        sum_ray += d_ray * att;
                        sum_mie += d_mie * att;
                    }
                    float c = dot(dir, -l);
                    float cc = c * c;
                    vec3 scatter = sum_ray * k_ray * phase_ray(cc) + sum_mie * k_mie * phase_mie(-0.78, c, cc);
                    return scatter;
                }

                mat3 rot3xy(vec2 angle) {
                    vec2 c = cos(angle);
                    vec2 s = sin(angle);
                    return mat3(
                        c.y,       0.0, -s.y,
                        s.y * s.x, c.x,  c.y * s.x,
                        s.y * c.x,-s.x,  c.y * c.x
                    );
                }

                vec3 ray_dir(float fov, vec2 size, vec2 uv) {
                    vec2 xy = uv * size - size * 0.5;
                    float cot_half_fov = tan(radians(90.0 - fov * 0.5));
                    float z = size.y * 0.5 * cot_half_fov;
                    return normalize(vec3(xy, -z));
                }

                void mainImage(out vec4 fragColor, in vec2 uv) {
                    vec3 dir = ray_dir(uFov, uResolution.xy, uv);
                    vec3 eye = vec3(0.0, 0.0, uCameraDistance);
                    mat3 rot = rot3xy(vec2(0.0, uTime * uRotationSpeed));
                    dir = rot * dir;
                    eye = rot * eye;
                    vec3 l = normalize(uSunDir);
                    vec2 e = ray_vs_sphere(eye, dir, R);
                    if (e.x > e.y) {
                        fragColor = vec4(uBackgroundColor, 1.0);
                        return;
                    }
                    vec2 f = ray_vs_sphere(eye, dir, R_INNER);
                    e.y = min(e.y, f.x);
                    vec3 I = in_scatter(eye, dir, e, l);
                    vec3 halo = I * uIntensity * 10.0;
                    float softMask = 1.0 - exp(-1.2 * colorLuma(halo));
                    vec3 rgb = blendAdaptive(uBackgroundColor, halo, softMask);
                    fragColor = vec4(rgb, 1.0);
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

window.GodRays = GodRays;
