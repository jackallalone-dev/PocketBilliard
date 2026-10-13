import * as THREE from 'three';
import { TABLE } from './table-geometry.js';
import { MAX_TIP_OFFSET } from './spin.js';
import { cuePose, cueContact, cueObstruction } from './cue-elevation.js';

const UP = new THREE.Vector3(0, 1, 0);
const vector = (p) => new THREE.Vector3(p.x, p.y, p.z);

// A separate camera and depth-tested cue, using the real table and ball assets.
// Shared table geometry/textures are owned by TableView, never disposed here.
export class SpinView {
  constructor(source) {
    this.source = source;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14271e);
    this.environment = new THREE.Group();this.scene.add(this.environment);
    const balls = new Set(source.ballMeshes.values());
    for (const child of source.scene.children) {
      if (child !== source.aimGroup && !balls.has(child)) {
        (child.isLight ? this.scene : this.environment).add(child.clone());
      }
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.015, 90);
    this.view = 'contact';
    this.ballMeshes = new Map();
    this.cue = this.makeCue(false);
    this.blockedCue = this.makeCue(true);

    const radius = TABLE.radius + 0.0015;
    const capAngle = Math.asin(MAX_TIP_OFFSET);
    this.cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 24, 0, Math.PI * 2, 0, capAngle),
      new THREE.MeshBasicMaterial({ color: 0x6adfbd, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    this.scene.add(this.cap);
    const ring = Array.from({ length: 97 }, (_, i) => {
      const a = i / 96 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * Math.sin(capAngle), Math.cos(capAngle), Math.sin(a) * Math.sin(capAngle)).multiplyScalar(radius + 0.001);
    });
    this.cap.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x76f5cd })));
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 12), new THREE.MeshBasicMaterial({ color: 0xff6554 }));
    this.scene.add(this.marker);
    const equator = Array.from({ length: 97 }, (_, i) => {
      const a = i / 96 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    });
    this.equator = new THREE.Line(new THREE.BufferGeometry().setFromPoints(equator), new THREE.LineDashedMaterial({ color: 0xc7a463, dashSize: 0.018, gapSize: 0.012 }));
    this.equator.computeLineDistances();this.scene.add(this.equator);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();this.contextLost = true;
      this.host.dataset.unavailable = 'true';
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;delete this.host.dataset.unavailable;this.render();
    });
  }

  makeCue(ghost) {
    const cue = this.source.cueGroup.clone();
    cue.renderOrder = 0;
    cue.traverse((part) => {
      part.renderOrder = 0;
      if (!part.material) return;
      part.material = part.material.clone();
      part.material.depthTest = true;part.material.depthWrite = !ghost;
      part.material.transparent = ghost;part.material.opacity = ghost ? 0.28 : 1;
      if (ghost) part.material.color.setHex(0xffb45d);
      part.castShadow = !ghost;
    });
    this.scene.add(cue);
    return cue;
  }

  mount(host, balls) {
    this.resizeObserver.disconnect();
    this.host = host;host.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(host);
    for (const mesh of this.ballMeshes.values()) {
      this.scene.remove(mesh);mesh.material.dispose();
    }
    this.ballMeshes.clear();
    for (const ball of balls) {
      if (ball.pocketed) continue;
      const mesh = this.source.ballMeshes.get(ball.id).clone();
      mesh.material = mesh.material.clone();
      mesh.position.set(ball.x, TABLE.radius + 0.028 + (ball.y || 0), ball.z);
      mesh.scale.setScalar(1);mesh.visible = true;
      this.scene.add(mesh);this.ballMeshes.set(ball.id, mesh);
    }
  }

  setView(view) { this.view = view;this.render(); }

  update(balls, angle, spin, elevation, requestedElevation) {
    this.state = { balls, angle, spin, elevation, requestedElevation };
    this.render();
  }

  render() {
    if (!this.state || !this.host?.closest('dialog')?.open || this.contextLost) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    const { balls, angle, spin, elevation, requestedElevation } = this.state;
    const cue = balls[0];
    const center = new THREE.Vector3(cue.x, TABLE.radius + 0.028 + (cue.y || 0), cue.z);
    const pose = cuePose(cue, angle, 0, spin, elevation);
    const back = vector(pose.back), right = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const levelBack = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const contactView = this.view === 'contact';
    this.environment.visible = !contactView;
    this.cue.visible = !contactView;
    this.cue.position.copy(vector(pose));
    this.cue.rotation.set(-pose.tilt, -angle, 0, 'YXZ');
    this.cap.position.copy(center);this.cap.quaternion.setFromUnitVectors(UP, back);
    this.marker.position.copy(vector(cueContact(cue, angle, spin, elevation)));
    this.equator.position.copy(center);

    const obstruction = cueObstruction(balls, angle, spin, elevation);
    const lowerObstruction = cueObstruction(balls, angle, spin, requestedElevation);
    const highlighted = obstruction ?? lowerObstruction;
    for (const [id, mesh] of this.ballMeshes) {
      mesh.visible = !contactView || id === 0;
      mesh.material.emissive.setHex(id === highlighted ? 0xa44913 : 0);
      mesh.material.emissiveIntensity = 0.65;
    }
    this.blockedCue.visible = !contactView && lowerObstruction !== null && requestedElevation < elevation;
    if (this.blockedCue.visible) {
      const lower = cuePose(cue, angle, 0, spin, requestedElevation);
      this.blockedCue.position.copy(vector(lower));this.blockedCue.rotation.set(-lower.tilt, -angle, 0, 'YXZ');
    }

    const target = center.clone();
    // Look straight down the cue axis: left/right and draw/follow now face
    // the player squarely, even when the cue is elevated.
    let direction = back.clone();
    let distance = 0.8;
    if (this.view === 'side') {
      direction = right.clone().addScaledVector(UP, 0.25).normalize();
      target.addScaledVector(back, 0.22);distance = 1.8;
    } else if (this.view === 'clearance') {
      // Include the blocking ball wherever it lies along the full shaft.
      const blocker = balls.find((ball) => ball.id === highlighted);
      const extent = blocker ? Math.min(5.5, Math.hypot(blocker.x - cue.x, blocker.z - cue.z) + 0.5) : 1.8;
      target.addScaledVector(levelBack, extent * 0.4).addScaledVector(UP, 0.12);
      direction = right.clone().addScaledVector(levelBack, 0.25).addScaledVector(UP, 0.6).normalize();
      distance = Math.max(2.8, extent * 2);
    }
    this.camera.aspect = width / height;
    // Keep the ball framed on narrow portrait screens too.
    distance /= Math.min(1, this.camera.aspect);
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.lookAt(target);this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  }
}
