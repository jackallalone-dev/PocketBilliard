import * as THREE from 'three';
import { TABLE, POCKETS, BALL_COLORS } from './physics.js';
import { CUSHIONS, pocketSurroundPoints } from './table-geometry.js';
import { GRAVITY } from './ball-motion.js';
import { BED_TOP, FRAME_TOP, FRAME_WALLS, CUSHION_FACES, surfacePositions, boundaryDistance } from './rail-geometry.js';
import { clampElevation } from './spin.js';
import { cuePose, CUE_START } from './cue-elevation.js';
import { elevatedPreview } from './elevated-preview.js';
import { shotEffects } from './shot-effects.js';
import { DEFAULT_AIM_AIDS } from './settings.js';
import { cuePathPreview } from './aim-preview.js';

const UP = new THREE.Vector3(0, 1, 0);
const BALL_TEXTURE_ORIENTATION = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const BALL_ORIENTATION = new THREE.Quaternion();

function feltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = Math.random() * 13;
    image.data[i] = 36 + noise;
    image.data[i + 1] = 101 + noise;
    image.data[i + 2] = 76 + noise;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function ballTexture(id) {
  const canvas = document.createElement('canvas');
  canvas.width = id === 0 ? 1024 : 512;canvas.height = canvas.width / 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = id > 8 ? '#f8f4e7' : BALL_COLORS[id];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (id === 0) {
    // Six equal spherical discs. Drawing flat circles in an equirectangular
    // texture pinches the spots near the poles and splits them at the seam.
    const { width, height } = canvas;
    const image = ctx.getImageData(0, 0, width, height);
    const radius = 0.115, feather = Math.PI / height;
    for (let y = 0; y < height; y++) {
      const latitude = (y + 0.5) / height * Math.PI;
      const ring = Math.sin(latitude), vertical = Math.abs(Math.cos(latitude));
      for (let x = 0; x < width; x++) {
        const longitude = (x + 0.5) / width * Math.PI * 2;
        const nearest = Math.max(vertical, Math.abs(ring * Math.cos(longitude)), Math.abs(ring * Math.sin(longitude)));
        const coverage = Math.max(0, Math.min(1, (radius - Math.acos(Math.min(1, nearest))) / feather + 0.5));
        if (!coverage) continue;
        const offset = (y * width + x) * 4;
        for (const [channel, color] of [190, 38, 35].entries()) image.data[offset + channel] = Math.round(image.data[offset + channel] * (1 - coverage) + color * coverage);
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  if (id > 8) {
    ctx.fillStyle = BALL_COLORS[id];
    ctx.fillRect(0, 70, 512, 116);
  }
  if (id) {
    for (const x of [128, 384]) {
      ctx.beginPath();ctx.ellipse(x, 128, 48, 48, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fffef4';ctx.fill();
      ctx.strokeStyle = '#d7d4c3';ctx.lineWidth = 1.5;ctx.stroke();
      ctx.fillStyle = '#080c0b';ctx.font = `900 ${id < 10 ? 68 : 58}px Arial`;ctx.textAlign = 'center';ctx.textBaseline = 'middle';
      ctx.fillText(String(id), x, 131);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function roundedShape(width, length, radius) {
  const x = -width / 2, y = -length / 2;
  const s = new THREE.Shape();
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + length - radius);s.quadraticCurveTo(x + width, y + length, x + width - radius, y + length);
  s.lineTo(x + radius, y + length);s.quadraticCurveTo(x, y + length, x, y + length - radius);
  s.lineTo(x, y + radius);s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function planShape(points) {
  return new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.z)));
}

function surfaceGeometry(faces) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surfacePositions(faces), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class TableView {
  constructor(container, { onLayout = () => {} } = {}) {
    this.container = container;
    this.onLayout = onLayout;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-7, 7, 12, -12, 0.1, 100);
    this.camera.position.set(0, 30, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(UP, -(TABLE.radius + 0.028));
    this.scene.add(new THREE.HemisphereLight(0xe8f0df, 0x243b2e, 2.6));
    const light = new THREE.DirectionalLight(0xfff4dc, 3.1);
    light.position.set(-6, 17, -7);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -8, right: 8, top: 12, bottom: -12, near: 1, far: 45 });
    light.shadow.bias = -0.0007;
    light.shadow.normalBias = 0.015;
    light.shadow.radius = 3;
    this.scene.add(light);
    const fill = new THREE.DirectionalLight(0xb7d7c7, 0.8);
    fill.position.set(8, 10, 6);this.scene.add(fill);
    this.ballMeshes = new Map();
    this.falling = new Map();
    this.buildTable();
    this.buildAim();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  roundedSlab(width, length, radius, depth, material, y) {
    const shape = roundedShape(width, length, radius);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.08, bevelThickness: 0.06, curveSegments: 10 });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  buildTable() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x292e29, roughness: 0.5, metalness: 0.12 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x14261d, roughness: 0.7 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xa89363, roughness: 0.45, metalness: 0.65 });
    this.roundedSlab(TABLE.frameWidth + 0.22, TABLE.frameLength + 0.22, 0.65, 0.36, edge, -0.7);
    this.roundedSlab(TABLE.frameWidth + 0.07, TABLE.frameLength + 0.07, 0.58, 0.08, brass, -0.33);
    const frame = new THREE.Mesh(surfaceGeometry([...FRAME_TOP, ...FRAME_WALLS]), wood);
    frame.name = 'rail-cap';frame.castShadow = true;frame.receiveShadow = true;this.scene.add(frame);
    const castingMaterial = new THREE.MeshStandardMaterial({ color: 0xa7ac9e, roughness: 0.38, metalness: 0.65 });
    for (const p of POCKETS) {
      const casting = new THREE.Mesh(new THREE.ShapeGeometry(planShape(pocketSurroundPoints(p)), 32), castingMaterial);
      casting.name = 'pocket-surround';
      casting.rotation.x = -Math.PI / 2;
      casting.position.y = TABLE.clothHeight + TABLE.railTopHeight + 0.0005;
      casting.receiveShadow = true;
      this.scene.add(casting);
    }

    // The cloth continues underneath the cushion jaws and has actual pocket holes.
    const felt = new THREE.Mesh(surfaceGeometry(BED_TOP), new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 1 }));
    const positions = felt.geometry.attributes.position, uv = [];
    for (let i = 0; i < positions.count; i++) uv.push(positions.getX(i) / TABLE.width, -positions.getZ(i) / TABLE.length);
    felt.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    felt.name = 'cloth';felt.receiveShadow = true;this.scene.add(felt);
    const cushion = new THREE.MeshStandardMaterial({ color: 0x326c50, roughness: 0.95 });
    const seam = new THREE.LineBasicMaterial({ color: 0x143d2e, transparent: true, opacity: 0.6 });
    for (const [index, points] of CUSHIONS.entries()) {
      const geometry = surfaceGeometry(CUSHION_FACES[index]);
      const a = points[0], b = points[1];
      const mesh = new THREE.Mesh(geometry, cushion);
      mesh.name = 'cushion';mesh.castShadow = true;mesh.receiveShadow = true;this.scene.add(mesh);
      const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(points[3].x, TABLE.clothHeight + TABLE.railTopHeight + 0.002, points[3].z),
        new THREE.Vector3(a.x, TABLE.clothHeight + TABLE.cushionNoseHeight + 0.002, a.z),
        new THREE.Vector3(b.x, TABLE.clothHeight + TABLE.cushionNoseHeight + 0.002, b.z),
        new THREE.Vector3(points[2].x, TABLE.clothHeight + TABLE.railTopHeight + 0.002, points[2].z),
      ]), seam);
      this.scene.add(edge);
    }
    const liner = new THREE.MeshStandardMaterial({ color: 0x172019, roughness: 0.95, side: THREE.DoubleSide });
    const darkness = new THREE.MeshBasicMaterial({ color: 0x050a08 });
    for (const p of POCKETS) {
      const lip = new THREE.Mesh(new THREE.RingGeometry(p.radius, p.radius + 0.085, 48), liner);
      lip.rotation.x = -Math.PI / 2;lip.position.set(p.x, 0.029, p.z);this.scene.add(lip);
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(p.radius, p.radius * 0.93, 0.16, 48, 1, true), liner);
      wall.position.set(p.x, -0.05, p.z);this.scene.add(wall);
      const well = new THREE.Mesh(new THREE.CircleGeometry(p.radius, 48), darkness);
      well.rotation.x = -Math.PI / 2;well.position.set(p.x, -0.132, p.z);this.scene.add(well);
    }
    const diamondMaterial = new THREE.MeshStandardMaterial({ color: 0xb7b192, roughness: 0.45, metalness: 0.15 });
    const diamond = (x, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.001, 0.105), diamondMaterial);
      mesh.position.set(x, TABLE.clothHeight + TABLE.railTopHeight + 0.0005, z);mesh.rotation.y = Math.PI / 4;this.scene.add(mesh);
    };
    for (const side of [-1, 1]) {
      const sightOffset = 3.6875 * TABLE.width / 50;
      for (const z of [-6.45, -4.3, -2.15, 2.15, 4.3, 6.45]) diamond(side * (TABLE.width / 2 + sightOffset), z);
      for (const x of [-2.15, 0, 2.15]) diamond(x, side * (TABLE.length / 2 + sightOffset));
    }

    const markingMat = new THREE.LineBasicMaterial({ color: 0xb7d7b6, transparent: true, opacity: 0.12 });
    const baulk = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4.1, 0.04, TABLE.headSpot), new THREE.Vector3(4.1, 0.04, TABLE.headSpot)]), markingMat);
    this.scene.add(baulk);
    for (const z of [TABLE.footSpot, TABLE.headSpot]) {
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.047, 16), new THREE.MeshBasicMaterial({ color: 0xa0bfa4, transparent: true, opacity: 0.4 }));
      spot.rotation.x = -Math.PI / 2;spot.position.set(0, 0.043, z);this.scene.add(spot);
    }

    const canvas = document.createElement('canvas');canvas.width = 512;canvas.height = 128;
    const ctx = canvas.getContext('2d');ctx.textAlign = 'center';ctx.fillStyle = '#abcab5';
    ctx.font = '500 34px Arial';ctx.fillText('P O C K E T   C L U B', 256, 56);
    ctx.font = '14px Arial';ctx.fillText('A  L I T T L E  F R I E N D L Y  C O M P E T I T I O N', 256, 89);
    const brand = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0.16, depthWrite: false }));
    brand.rotation.x = -Math.PI / 2;brand.position.set(0, 0.046, 1.5);this.scene.add(brand);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.19 }));
    floor.rotation.x = -Math.PI / 2;floor.position.y = -0.85;floor.receiveShadow = true;this.scene.add(floor);
  }

  buildAim() {
    this.aimGroup = new THREE.Group();this.scene.add(this.aimGroup);
    this.guide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xf4eed7, transparent: true, opacity: 0.65, dashSize: 0.13, gapSize: 0.15 }));
    this.aimGroup.add(this.guide);
    this.targetGuide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xf4d08b, transparent: true, opacity: 0.5, dashSize: 0.11, gapSize: 0.13 }));
    this.aimGroup.add(this.targetGuide);
    this.cueGuide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x9de4e5, transparent: true, opacity: 0.8, dashSize: 0.1, gapSize: 0.12 }));
    this.aimGroup.add(this.cueGuide);
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(TABLE.radius * 0.88, TABLE.radius, 32), new THREE.MeshBasicMaterial({ color: 0xf4eed7, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.ghost.rotation.x = -Math.PI / 2;this.aimGroup.add(this.ghost);
    this.landingGhost = new THREE.Mesh(new THREE.RingGeometry(TABLE.radius * 0.65, TABLE.radius * 0.8, 32), new THREE.MeshBasicMaterial({ color: 0xffbc72, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.landingGhost.rotation.x = -Math.PI / 2;this.aimGroup.add(this.landingGhost);
    for (const guide of [this.guide, this.targetGuide, this.cueGuide, this.ghost, this.landingGhost]) {
      guide.material.depthTest = false;guide.material.depthWrite = false;
      guide.renderOrder = 80;
    }
    this.cueGroup = new THREE.Group();this.aimGroup.add(this.cueGroup);
    this.cueGroup.renderOrder = 100;
    // Build outward from the ball. Negative X rotation puts radiusTop at the
    // near end (-Z), so each section widens toward the butt, not toward the tip.
    let end = CUE_START;
    const part = (name, length, nearRadius, farRadius, color, roughness = 0.5) => {
      // The aiming cue is an overlay: balls and rails must never hide its parts.
      // Use the late transparent pass, without reading or writing scene depth.
      const material = new THREE.MeshStandardMaterial({ color, roughness, transparent: true, depthTest: false, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(nearRadius, farRadius, length, 16), material);
      mesh.name = name;
      mesh.renderOrder = 100;
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = end + length / 2;
      mesh.castShadow = true;
      this.cueGroup.add(mesh);
      end += length;
    };
    part('tip', 0.065, 0.035, 0.035, 0x699fa3, 0.85);
    part('ferrule', 0.16, 0.035, 0.036, 0xf3e9ce);
    part('shaft', 3.25, 0.036, 0.063, 0xe2bc7c);
    part('joint', 0.075, 0.063, 0.063, 0xb1a68d, 0.35);
    part('handle', 1.45, 0.063, 0.082, 0x3c2821, 0.6);
    part('bumper', 0.075, 0.082, 0.082, 0x171c18, 0.9);
  }

  resetBalls(balls) {
    this.needsRender = true;
    for (const mesh of this.ballMeshes.values()) {
      this.scene.remove(mesh);mesh.material.map.dispose();mesh.material.dispose();mesh.geometry.dispose();
    }
    this.ballMeshes.clear();this.falling.clear();
    for (const ball of balls) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(TABLE.radius, ball.id === 0 ? 64 : 32, ball.id === 0 ? 48 : 24), new THREE.MeshPhysicalMaterial({
        map: ballTexture(ball.id), roughness: 0.28, metalness: 0,
        clearcoat: 0.65, clearcoatRoughness: 0.2,
      }));
      mesh.position.set(ball.x, TABLE.radius + 0.028 + (ball.y || 0), ball.z);mesh.rotation.x = -Math.PI / 2;mesh.castShadow = true;
      this.ballMeshes.set(ball.id, mesh);this.scene.add(mesh);
    }
  }

  pocket(id, pocket) {
    const mesh = this.ballMeshes.get(id);
    this.falling.set(id, { time: 0, x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, pocket });
  }

  offTable(event) {
    this.falling.set(event.id, { ...event, y: TABLE.radius + TABLE.clothHeight + event.y, time: 0, offTable: true });
  }

  sync(balls, dt) {
    let changed = false;
    for (const ball of balls) {
      const mesh = this.ballMeshes.get(ball.id);
      const fall = this.falling.get(ball.id);
      if (ball.pocketed) {
        if (fall && fall.time < 0.3) {
          changed = true;
          fall.time += dt;
          const t = Math.min(1, fall.time / 0.3);
          if (fall.offTable) {
            const elapsed = fall.time;
            if (fall.reason === 'resting-on-rail') mesh.position.set(fall.x, fall.y, fall.z);
            else mesh.position.set(fall.x + fall.vx * elapsed, fall.y + fall.vy * elapsed - GRAVITY / 2 * elapsed ** 2, fall.z + fall.vz * elapsed);
          } else mesh.position.set(THREE.MathUtils.lerp(fall.x, fall.pocket.x, t), (fall.y ?? TABLE.radius + TABLE.clothHeight) - 0.75 * t * t, THREE.MathUtils.lerp(fall.z, fall.pocket.z, t));
          mesh.scale.setScalar(fall.reason === 'resting-on-rail' ? 1 - t : 1 - t * 0.15);
          mesh.visible = t < 1;
        } else mesh.visible = false;
      } else {
        if (!mesh.visible || mesh.scale.x !== 1) changed = true;
        this.falling.delete(ball.id);mesh.visible = true;mesh.scale.setScalar(1);
        const dx = ball.x - mesh.position.x, dz = ball.z - mesh.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.00001 || Math.abs(mesh.position.y - TABLE.radius - 0.028 - (ball.y || 0)) > 0.00001) changed = true;
        if (ball.qw !== undefined) {
          BALL_ORIENTATION.set(ball.qx, ball.qy, ball.qz, ball.qw).multiply(BALL_TEXTURE_ORIENTATION);
          if (1 - Math.abs(mesh.quaternion.dot(BALL_ORIENTATION)) > 1e-10) {
            mesh.quaternion.copy(BALL_ORIENTATION);changed = true;
          }
        } else if (distance > 0.00001) mesh.rotateOnWorldAxis(new THREE.Vector3(dz, 0, -dx).normalize(), distance / TABLE.radius);
        mesh.position.set(ball.x, TABLE.radius + 0.028 + (ball.y || 0), ball.z);
      }
    }
    return changed;
  }

  updateAim(balls, angle, power, visible, spin = {}, aids = DEFAULT_AIM_AIDS, elevation = 0) {
    this.aimGroup.visible = visible;
    if (!visible) return;
    const cue = balls[0], dx = Math.sin(angle), dz = -Math.cos(angle);
    elevation = clampElevation(elevation);
    this.guide.visible = aids.guideLine;
    this.ghost.visible = aids.contactCircle;
    this.landingGhost.visible = false;
    let distance = boundaryDistance(cue.x, cue.z, dx, dz);
    let target = null;
    for (const ball of elevation > 0 ? [] : balls) {
      if (ball.id === 0 || ball.pocketed) continue;
      const bx = ball.x - cue.x, bz = ball.z - cue.z;
      const along = bx * dx + bz * dz;
      const perpendicularSq = Math.max(0, bx * bx + bz * bz - along * along);
      if (along <= 0 || perpendicularSq >= (TABLE.radius * 2) ** 2) continue;
      const contact = along - Math.sqrt((TABLE.radius * 2) ** 2 - perpendicularSq);
      if (contact >= 0 && contact < distance) { distance = contact;target = ball; }
    }
    let end = new THREE.Vector3(cue.x + dx * distance, TABLE.radius + 0.04, cue.z + dz * distance);
    let points = [new THREE.Vector3(cue.x, end.y, cue.z), end];
    if (elevation > 0 && (aids.guideLine || aids.targetLine || aids.contactCircle)) {
      const preview = elevatedPreview(balls, angle, power, spin, elevation);
      points = preview.points.map((p) => new THREE.Vector3(p.x, TABLE.radius + 0.04 + p.y, p.z));
      end = points.at(-1);target = preview.target;
      this.ghost.visible = !!target && aids.contactCircle;
      if (preview.landing) {
        this.landingGhost.position.set(preview.landing.x, TABLE.clothHeight + preview.landing.y + 0.02, preview.landing.z);
        this.landingGhost.visible = aids.contactCircle;
      }
    }
    const color = elevation > 0 ? shotEffects(spin, elevation, power || 0.65).curve ? 0xc5a2ff : 0xffbc72 : 0xf4eed7;
    this.guide.material.color.setHex(color);
    this.ghost.material.color.setHex(color);
    this.guide.geometry.dispose();
    this.guide.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.guide.computeLineDistances();
    this.ghost.position.set(end.x, 0.05, end.z);
    this.targetGuide.visible = !!target && aids.targetLine;
    this.cueGuide.visible = false;
    if (target) {
      const normal = new THREE.Vector3(target.x - end.x, 0, target.z - end.z).normalize();
      const start = new THREE.Vector3(target.x, end.y, target.z);
      this.targetGuide.geometry.dispose();
      this.targetGuide.geometry = new THREE.BufferGeometry().setFromPoints([start, start.clone().addScaledVector(normal, 1.6)]);
      this.targetGuide.computeLineDistances();
      if (aids.cueLine && elevation === 0) {
        const points = cuePathPreview(balls, target, end, angle, power, spin);
        if (points.length > 1) {
          this.cueGuide.geometry.dispose();
          this.cueGuide.geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, end.y, p.z)));
          this.cueGuide.computeLineDistances();this.cueGuide.visible = true;
        }
      }
    }
    const pose = cuePose(cue, angle, power, spin, elevation);
    this.cueGroup.position.set(pose.x, pose.y, pose.z);
    this.cueGroup.rotation.set(-pose.tilt, -angle, 0, 'YXZ');
  }

  pointFromScreen(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const pointer = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.aimPlane, new THREE.Vector3());
  }

  pointToScreen(point) {
    const rect = this.container.getBoundingClientRect();
    const projected = point.clone().project(this.camera);
    return { x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (1 - projected.y) * rect.height / 2 };
  }

  ballToScreen(ball) {
    const center = this.pointToScreen(new THREE.Vector3(ball.x, TABLE.radius + 0.028, ball.z));
    const edge = this.pointToScreen(new THREE.Vector3(ball.x + TABLE.radius, TABLE.radius + 0.028, ball.z));
    return { ...center, radius: Math.hypot(edge.x - center.x, edge.y - center.y) };
  }

  hitCue(clientX, clientY, cue) {
    if (!this.aimGroup.visible) return false;
    this.cueGroup.updateWorldMatrix(true, false);
    const tip = this.cueGroup.getObjectByName('tip');
    const butt = this.cueGroup.getObjectByName('bumper');
    const a = this.pointToScreen(this.cueGroup.localToWorld(new THREE.Vector3(0, 0, tip.position.z - tip.geometry.parameters.height / 2)));
    const b = this.pointToScreen(this.cueGroup.localToWorld(new THREE.Vector3(0, 0, butt.position.z + butt.geometry.parameters.height / 2)));
    const ball = this.pointToScreen(new THREE.Vector3(cue.x, TABLE.radius + 0.028, cue.z));
    if (Math.hypot(clientX - ball.x, clientY - ball.y) < 16) return false;
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < 1) return false;
    const t = Math.max(0, Math.min(1, ((clientX - a.x) * dx + (clientY - a.y) * dy) / lengthSq));
    // Screen-space padding stays finger-friendly at every zoom and orientation.
    return Math.hypot(clientX - a.x - dx * t, clientY - a.y - dy * t) <= 16;
  }

  frameScreenBounds() {
    const rect = this.container.getBoundingClientRect();
    const points = [];
    for (const x of [-1, 1].map((s) => s * (TABLE.frameWidth / 2 + 0.15))) {
      for (const z of [-1, 1].map((s) => s * (TABLE.frameLength / 2 + 0.15))) points.push(this.pointToScreen(new THREE.Vector3(x, 0, z)));
    }
    const left = Math.min(...points.map((p) => p.x)) - rect.left;
    const right = Math.max(...points.map((p) => p.x)) - rect.left;
    const top = Math.min(...points.map((p) => p.y)) - rect.top;
    const bottom = Math.max(...points.map((p) => p.y)) - rect.top;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  resize() {
    this.needsRender = true;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    // A strictly vertical view in both orientations. Only the screen's up
    // direction changes; the camera never tilts or foreshortens the table.
    const horizontal = aspect >= 1;
    this.camera.position.set(0, 30, 0);
    this.camera.up.set(horizontal ? 1 : 0, 0, horizontal ? 0 : -1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);

    // Fit the full frame with a small margin instead of a fixed, zoomed-out view.
    const bounds = new THREE.Box3();
    for (const x of [-1, 1].map((s) => s * (TABLE.frameWidth / 2 + 0.15))) {
      for (const y of [-0.85, 0.5]) {
        for (const z of [-1, 1].map((s) => s * (TABLE.frameLength / 2 + 0.15))) {
          bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
        }
      }
    }
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const viewHeight = Math.max(size.y, size.x / aspect) * 1.025;
    this.camera.left = center.x - viewHeight * aspect / 2;
    this.camera.right = center.x + viewHeight * aspect / 2;
    this.camera.top = center.y + viewHeight / 2;
    this.camera.bottom = center.y - viewHeight / 2;
    this.camera.updateProjectionMatrix();
    if (this.onLayout) this.onLayout(this.frameScreenBounds());
  }

  render() { this.renderer.render(this.scene, this.camera);this.needsRender = false; }
}
