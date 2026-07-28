import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './Ferrofluid.css';

const MAX_COLORS = 8;
const hexToRgb = (hex) => {
    const value = hex.replace('#', '').padEnd(6, '0');
    return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
};
const prepareColors = (colors) => {
    const source = (colors?.length ? colors : ['#ffffff']).slice(0, MAX_COLORS);
    return Array.from({ length: MAX_COLORS }, (_, index) => hexToRgb(source[Math.min(index, source.length - 1)]));
};
const flowVector = (direction) => ({ up: [0, 1], left: [-1, 0], right: [1, 0], down: [0, -1] }[direction] || [0, -1]);

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
precision highp float;
uniform vec3 iResolution; uniform vec2 iMouse; uniform float iTime;
uniform vec3 uColor0; uniform vec3 uColor1; uniform vec3 uColor2; uniform vec3 uColor3;
uniform vec3 uColor4; uniform vec3 uColor5; uniform vec3 uColor6; uniform vec3 uColor7;
uniform int uColorCount; uniform vec2 uFlow; uniform float uSpeed; uniform float uScale;
uniform float uTurbulence; uniform float uFluidity; uniform float uRimWidth; uniform float uSharpness;
uniform float uShimmer; uniform float uGlow; uniform float uOpacity; uniform float uMouseEnabled;
uniform float uMouseStrength; uniform float uMouseRadius; varying vec2 vUv;
#define PI 3.14159265
vec3 palette(float h) { int count = uColorCount; if (count < 1) count = 1; int index = int(floor(clamp(h, 0.0, 0.999999) * float(count))); if (index <= 0) return uColor0; if (index == 1) return uColor1; if (index == 2) return uColor2; if (index == 3) return uColor3; if (index == 4) return uColor4; if (index == 5) return uColor5; if (index == 6) return uColor6; return uColor7; }
float hash(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 33.33); return fract((p.x + p.y) * p.z); }
float smin(float a, float b, float k) { return -k * log2(exp2(-a / k) + exp2(-b / k)); }
float smoothsin(float a, float b, float weight) { return mix(a, b, (sin(weight * PI - PI / 2.0) + 1.0) / 2.0); }
float valueNoise(vec2 p, float size, float seed) { vec2 cell = floor(p / size); vec2 relative = mod(p, size); float a = hash(vec3(cell, seed)); float b = hash(vec3(cell.x + 1.0, cell.y, seed)); float c = hash(vec3(cell.x + 1.0, cell.y + 1.0, seed)); float d = hash(vec3(cell.x, cell.y + 1.0, seed)); return smoothsin(smoothsin(a, b, relative.x / size), smoothsin(d, c, relative.x / size), relative.y / size); }
float detailNoise(vec2 p, float size, float seed) { float halfSize = size / 2.0; return (2.0 * valueNoise(p, size, seed) + 1.5 * valueNoise(p + vec2(halfSize), size, seed + .1) + 1.25 * valueNoise(p + vec2(-halfSize, halfSize), size, seed + .2) + 1.125 * valueNoise(p + vec2(halfSize, -halfSize), size, seed + .3) + valueNoise(p - vec2(halfSize), size, seed + .4)) / 7.0; }
void main() {
  float reference = 700.0 / max(uScale, .05); vec2 point = vUv * iResolution.xy / iResolution.y * reference;
  float time = iTime; float movement = 200.0 * uSpeed; vec2 perpendicular = vec2(-uFlow.y, uFlow.x);
  float distortionA = valueNoise(point + perpendicular * (time * movement), 60.0, 10.0) * 50.0 * uTurbulence;
  float distortionB = valueNoise(point - perpendicular * (time * movement), 120.0, 15.0) * 100.0 * uTurbulence;
  float peaks = detailNoise(point + distortionA + uFlow * (time * movement * .5), 40.0, 1.0);
  float peaksB = detailNoise(point + distortionB - uFlow * (time * movement * .5), 40.0, 0.0);
  float merged = smin(peaks, peaksB, max(uFluidity, .001)); float mouseGlow = 0.0;
  if (uMouseEnabled > .5) { vec2 mouse = iMouse / iResolution.y * reference; float distance = length(point - mouse) / reference; float radius = max(uMouseRadius, .02); mouseGlow = exp(-distance * distance / (radius * radius)) * uMouseStrength; }
  float band = (uRimWidth - abs((merged - .4) * 2.0)) * 5.0;
  float lightness = clamp(band - valueNoise(point + uFlow * (time * movement * .5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
  lightness = pow(lightness, uSharpness) * uGlow * clamp(1.0 - mouseGlow, 0.0, 1.0);
  vec3 outputColor = palette(clamp(.5 + (peaks - peaksB) * .8, 0.0, 1.0)) * lightness;
  gl_FragColor = vec4(outputColor, clamp(max(outputColor.r, max(outputColor.g, outputColor.b)), 0.0, 1.0) * uOpacity);
}
`;

export default function Ferrofluid({
    className = '', eventTargetRef, dpr = 1.25, paused = false, colors = ['#ffffff'], speed = 0.5,
    scale = 1.6, turbulence = 1, fluidity = 0.1, rimWidth = 0.2, sharpness = 2.5, shimmer = 1.5,
    glow = 2, flowDirection = 'down', opacity = 1, mouseInteraction = true, mouseStrength = 1,
    mouseRadius = 0.35, mouseDampening = 0.15, mixBlendMode
}) {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || paused) return undefined;
        const renderer = new Renderer({ dpr: Math.min(dpr, 1.5), alpha: true, antialias: true });
        const gl = renderer.gl;
        const canvas = gl.canvas;
        gl.clearColor(0, 0, 0, 0);
        container.appendChild(canvas);
        const prepared = prepareColors(colors);
        const uniforms = {
            iResolution: { value: [1, 1, 1] }, iMouse: { value: [0, 0] }, iTime: { value: 0 },
            uColor0: { value: prepared[0] }, uColor1: { value: prepared[1] }, uColor2: { value: prepared[2] }, uColor3: { value: prepared[3] },
            uColor4: { value: prepared[4] }, uColor5: { value: prepared[5] }, uColor6: { value: prepared[6] }, uColor7: { value: prepared[7] },
            uColorCount: { value: Math.min(colors.length, MAX_COLORS) }, uFlow: { value: flowVector(flowDirection) }, uSpeed: { value: speed },
            uScale: { value: scale }, uTurbulence: { value: turbulence }, uFluidity: { value: fluidity }, uRimWidth: { value: rimWidth },
            uSharpness: { value: sharpness }, uShimmer: { value: shimmer }, uGlow: { value: glow }, uOpacity: { value: opacity },
            uMouseEnabled: { value: mouseInteraction ? 1 : 0 }, uMouseStrength: { value: mouseStrength }, uMouseRadius: { value: mouseRadius }
        };
        const program = new Program(gl, { vertex, fragment, uniforms });
        if (!program.uniformLocations) {
            console.warn('Ferrofluid could not initialize its WebGL shader.');
            if (canvas.parentElement === container) container.removeChild(canvas);
            return undefined;
        }
        const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
        const resize = () => { const rect = container.getBoundingClientRect(); renderer.setSize(rect.width, rect.height); uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1]; };
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        const pointerTarget = eventTargetRef?.current || canvas;
        const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const mouseTarget = [0, 0];
        const onPointerMove = (event) => { const rect = canvas.getBoundingClientRect(); mouseTarget[0] = (event.clientX - rect.left) * renderer.dpr; mouseTarget[1] = (rect.bottom - event.clientY) * renderer.dpr; if (mouseDampening <= 0) uniforms.iMouse.value = [...mouseTarget]; };
        if (mouseInteraction && supportsFinePointer) pointerTarget.addEventListener('pointermove', onPointerMove);
        let animationFrame;
        let lastTime = 0;
        const render = (time) => {
            const delta = Math.min((time - lastTime) / 1000 || 0, .05);
            lastTime = time;
            uniforms.iTime.value = time * .001;
            if (mouseDampening > 0) { const factor = 1 - Math.exp(-delta / Math.max(mouseDampening, .001)); uniforms.iMouse.value[0] += (mouseTarget[0] - uniforms.iMouse.value[0]) * factor; uniforms.iMouse.value[1] += (mouseTarget[1] - uniforms.iMouse.value[1]) * factor; }
            renderer.render({ scene: mesh });
            animationFrame = window.requestAnimationFrame(render);
        };
        animationFrame = window.requestAnimationFrame(render);
        return () => { window.cancelAnimationFrame(animationFrame); observer.disconnect(); if (mouseInteraction && supportsFinePointer) pointerTarget.removeEventListener('pointermove', onPointerMove); if (canvas.parentElement === container) container.removeChild(canvas); };
    }, [colors, dpr, eventTargetRef, flowDirection, fluidity, glow, mouseDampening, mouseInteraction, mouseRadius, mouseStrength, opacity, paused, rimWidth, scale, sharpness, shimmer, speed, turbulence]);

    return <div ref={containerRef} className={`ferrofluid-container ${className}`} style={mixBlendMode ? { mixBlendMode } : undefined} />;
}
