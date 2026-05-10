// shapes.js — Random 3D geometry definitions + shaders using config
import * as THREE from 'https://esm.sh/three@0.136.0';
import CONFIG from './config.js';

export const SHAPES = [
    { name: 'Icosahedron', make: () => new THREE.IcosahedronGeometry(2, 20) },
    { name: 'Torus Knot', make: () => new THREE.TorusKnotGeometry(1.5, 0.5, 128, 32) },
    { name: 'Octahedron', make: () => new THREE.OctahedronGeometry(2.2, 6) },
    { name: 'Dodecahedron', make: () => new THREE.DodecahedronGeometry(2, 8) },
    { name: 'Torus', make: () => new THREE.TorusGeometry(1.6, 0.7, 32, 64) },
    { name: 'Sphere', make: () => new THREE.SphereGeometry(2, 64, 64) },
];

export function pickRandom() {
    return SHAPES[Math.floor(Math.random() * SHAPES.length)];
}

// --- GLSL Shaders ---
export const vertexShader = `
uniform float uTime;
uniform float uBass;
uniform float uType;
varying vec2 vUv;
varying float vDisp;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main(){
  vUv=uv;
  float nf=2.0+uBass*2.0;
  float na=0.3+uBass*0.8;
  vec3 p=position;
  float ag=(uType>0.5)?2.0:1.0;
  float n=snoise(p*nf+uTime*ag);
  p+=normal*n*na;
  vDisp=n;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;

// Build fragment shader using CONFIG colors
const md = CONFIG.matterDarkColor;
const mb = CONFIG.matterBrightColor;
const ad = CONFIG.antiDarkColor;
const ab = CONFIG.antiBrightColor;
const cb = CONFIG.colorBoostOnBass;

export const fragmentShader = `
uniform float uBass;
uniform float uType;
varying float vDisp;
void main(){
  vec3 color;
  float intensity=smoothstep(-0.2,0.5,vDisp)+uBass;
  if(uType<0.5){
    color=mix(vec3(${md[0]},${md[1]},${md[2]}),vec3(${mb[0]},${mb[1]},${mb[2]}),intensity);
  } else {
    color=mix(vec3(${ad[0]},${ad[1]},${ad[2]}),vec3(${ab[0]},${ab[1]},${ab[2]}),intensity);
  }
  color+=vec3(intensity*uBass*${cb});
  gl_FragColor=vec4(color,1.0);
}`;
