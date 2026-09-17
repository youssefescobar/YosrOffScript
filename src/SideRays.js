import { Renderer, Triangle, Program, Mesh } from 'ogl';

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const int = parseInt(hex, 16);
  return [(int >> 16 & 255) / 255, (int >> 8 & 255) / 255, (int & 255) / 255];
}

function originToFlip(origin) {
  switch (origin) {
    case 'top-left': return [0, 0];
    case 'top-right': return [1, 0];
    case 'bottom-left': return [0, 1];
    case 'bottom-right': return [1, 1];
    default: return [1, 0];
  }
}

export function initSideRays(containerSelector, options = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) return null;

  const {
    speed = 0.5,
    rayColor1 = '#c8b8a8',
    rayColor2 = '#6a6560',
    intensity = 0.8,
    spread = 1.5,
    origin = 'top-right',
    tilt = 0,
    saturation = 0.5,
    blend = 0.5,
    falloff = 1.2,
    opacity = 0.6 // increased visibility
  } = options;

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  gl.canvas.style.width = '100%';
  gl.canvas.style.height = '100%';
  gl.canvas.style.position = 'absolute';
  gl.canvas.style.top = '0';
  gl.canvas.style.left = '0';
  gl.canvas.style.zIndex = '0';
  gl.canvas.style.pointerEvents = 'none';

  container.appendChild(gl.canvas);

  const vert = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const frag = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

  const [flipX, flipY] = originToFlip(origin);
  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    iSpeed: { value: speed },
    iRayColor1: { value: hexToRgb(rayColor1) },
    iRayColor2: { value: hexToRgb(rayColor2) },
    iIntensity: { value: intensity },
    iSpread: { value: spread },
    iFlipX: { value: flipX },
    iFlipY: { value: flipY },
    iTilt: { value: tilt },
    iSaturation: { value: saturation },
    iBlend: { value: blend },
    iFalloff: { value: falloff },
    iOpacity: { value: opacity }
  };

  const geometry = new Triangle(gl);
  const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
  const mesh = new Mesh(gl, { geometry, program });

  let animationId = null;

  const updateSize = () => {
    renderer.dpr = Math.min(window.devicePixelRatio, 2);
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    uniforms.iResolution.value = [w * renderer.dpr, h * renderer.dpr];
  };

  const loop = t => {
    uniforms.iTime.value = t * 0.001;
    renderer.render({ scene: mesh });
    animationId = requestAnimationFrame(loop);
  };

  window.addEventListener('resize', updateSize);
  updateSize();
  animationId = requestAnimationFrame(loop);

  return function destroy() {
    if (animationId) cancelAnimationFrame(animationId);
    window.removeEventListener('resize', updateSize);
    
    // Smooth fade out of canvas before destroying
    gl.canvas.style.transition = 'opacity 1.2s ease';
    gl.canvas.style.opacity = '0';
    
    setTimeout(() => {
      if (gl.canvas && gl.canvas.parentNode) {
        gl.canvas.parentNode.removeChild(gl.canvas);
      }
      try {
        const loseCtx = gl.getExtension('WEBGL_lose_context');
        if (loseCtx) loseCtx.loseContext();
      } catch (e) {}
    }, 1200);
  };
}
