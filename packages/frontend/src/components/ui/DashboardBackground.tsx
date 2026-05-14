import { ShaderMount } from "@paper-design/shaders-react";

import { useIsDark } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Deep forest landscape — near-black sky at top, deep forest at bottom,
// faint sage highlights catching warped contour ridges in the lower half.
// Evokes dusk-in-the-woods rather than painted bands.
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;

uniform vec3 u_cSky;       // near-black (top)
uniform vec3 u_cDark;      // deepest forest (upper mid)
uniform vec3 u_cForest;    // mid forest (base)
uniform vec3 u_cRidgeLo;   // forest ridge shadow
uniform vec3 u_cRidgeHi;   // sage ridge highlight
uniform float u_ridgeDensity;   // how many ridges fit vertically
uniform float u_rotationDeg;
uniform float u_noiseScale;
uniform float u_noiseAmp;
uniform float u_drift;

out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 2; i++) {
    v += a * snoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p;
    a *= 0.5;
  }
  return v;
}

vec2 rot(vec2 p, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * p;
}

void main() {
  // screen-space uv (centered, aspect-preserving)
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

  // separate, un-rotated vertical fraction for the sky→ground gradient.
  // rotated uv is only used for the ridge field so darkness stays horizontal.
  float yFrac = gl_FragCoord.y / u_resolution.y;

  float th = radians(u_rotationDeg);
  vec2 ruv = rot(uv, th);
  float t = u_time * u_drift;

  // Low-frequency warp for the ridge curves — bends the sine field into
  // hill-like contours that slowly breathe.
  vec2 np = vec2(ruv.x * 0.4, ruv.y * 0.18) * u_noiseScale + vec2(t * 0.5, -t * 0.3);
  float n = fbm(np);

  // Warped ridge field. Sine peaks become narrow highlight lines where
  // light would catch the crest of a rolling hill.
  float ridgePos = ruv.y * u_ridgeDensity + n * u_noiseAmp + t * 0.15;
  float sine = sin(ridgePos * 3.14159);
  // Narrow crest highlights only — the faint "light catching a ridge" look.
  float ridgeHi = smoothstep(0.92, 1.0, sine);
  float ridgeLo = smoothstep(0.92, 1.0, -sine);

  // Ridges live only in the lower third. Strongest at the bottom, gone by
  // mid-screen. Everything above reads as sky.
  float groundMask = 1.0 - smoothstep(0.05, 0.55, yFrac);
  ridgeHi *= groundMask;
  ridgeLo *= groundMask;

  // Vertical gradient: near-black sky almost everywhere, darkening aggressively
  // upward, only the bottom fifth carrying any forest light.
  float skyFactor = pow(smoothstep(0.15, 0.9, yFrac), 1.4);
  vec3 base = mix(u_cForest, u_cDark, smoothstep(0.0, 0.35, yFrac));
  base = mix(base, u_cSky, skyFactor);

  // Ridge light & shadow overlays — faint atmospheric light, not stripes.
  base = mix(base, u_cRidgeHi, ridgeHi * 0.22);
  base = mix(base, u_cRidgeLo, ridgeLo * 0.12);

  // faint film grain
  float grain = snoise(gl_FragCoord.xy * 0.8) * 0.012;
  base += grain;

  fragColor = vec4(base, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

// Deep forest landscape background used on auth/identity screens.
export function DashboardBackground({ className }: { className?: string }) {
  const dark = useIsDark();

  // Both modes are intentionally dark — the login experience is always
  // "dusk in the forest" regardless of app theme. Dark mode goes a shade
  // deeper on the sky.
  const light = {
    cSky: "#020e07",
    cDark: "#051c0e",
    cForest: "#0d3a20",
    cRidgeLo: "#041806",
    cRidgeHi: "#5a8a6a",
  };
  const darkP = {
    cSky: "#010604",
    cDark: "#03140a",
    cForest: "#082c19",
    cRidgeLo: "#031208",
    cRidgeHi: "#4a7a5a",
  };
  const p = dark ? darkP : light;

  return (
    <ShaderMount
      className={cn("absolute inset-0", className)}
      style={{ width: "100%", height: "100%" }}
      fragmentShader={fragmentShader}
      speed={1}
      uniforms={{
        u_cSky: hexToRgb(p.cSky),
        u_cDark: hexToRgb(p.cDark),
        u_cForest: hexToRgb(p.cForest),
        u_cRidgeLo: hexToRgb(p.cRidgeLo),
        u_cRidgeHi: hexToRgb(p.cRidgeHi),
        u_ridgeDensity: 3.2,
        u_rotationDeg: 18,
        u_noiseScale: 1.0,
        u_noiseAmp: 0.35,
        u_drift: 0.02,
      }}
    />
  );
}
