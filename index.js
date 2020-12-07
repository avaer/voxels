import * as THREE from 'three';
import {BufferGeometryUtils} from 'BufferGeometryUtils';
import {renderer, scene, camera, app} from 'app';
import {Reflector} from './Reflector.js';
// import Avatar from 'https://avatars.exokit.org/avatars.js';
// import ModelLoader from 'https://model-loader.exokit.org/model-loader.js';
import {XRRaycaster, XRChunker} from './spatial-engine/spatial-engine.js';

(async () => {

const parcelSize = 16;
const width = 10;
const height = 10;
const depth = 10;
const colorTargetSize = 64;
const voxelSize = 0.1;
const marchCubesTexSize = 2048;
const fov = 90;
const aspect = 1;
const raycastNear = 0.1;
const raycastFar = 100;
const raycastDepth = 3;
const walkSpeed = 0.0015;

const zeroVector = new THREE.Vector3(0, 0, 0);
const zeroQuaternion = new THREE.Quaternion();
const oneVector = new THREE.Vector3(1, 1, 1);
const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localEuler = new THREE.Euler();
const localMatrix = new THREE.Matrix4();
const localRaycaster = new THREE.Raycaster();
const localRay = new THREE.Ray();
const localColor = new THREE.Color();
const localColor2 = new THREE.Color();

/* const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('hero-canvas'),
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(localColor.setRGB(1, 1, 1), 1);
renderer.sortObjects = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; */
/* renderer.physicallyCorrectLights = true;
renderer.gammaFactor = 2.2; */

// window.browser.magicleap.RequestDepthPopulation(true);
// renderer.autoClear = false;

const container = new THREE.Object3D();

/* const ambientLight = new THREE.AmbientLight(0x808080);
scene.add(ambientLight); */

/* {
  const SHADOW_MAP_WIDTH = 1024;
  const SHADOW_MAP_HEIGHT = 1024;

  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
  directionalLight.position.set(-3, 3, 1).multiplyScalar(2);
  directionalLight.target.position.set(0, 0, 0);

  directionalLight.castShadow = true;

  directionalLight.shadow = new THREE.LightShadow(new THREE.PerspectiveCamera( 50, 1, 0.1, 50 ));

  directionalLight.shadow.mapSize.width = SHADOW_MAP_WIDTH;
  directionalLight.shadow.mapSize.height = SHADOW_MAP_HEIGHT;

  container.add(directionalLight);
} */

const floorBaseMesh = (() => {
  const geometry = new THREE.PlaneBufferGeometry(100, 100)
    .applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), -Math.PI/2))
    .applyMatrix4(localMatrix.makeTranslation(0, -0.1, 0));
  const material = new THREE.MeshPhongMaterial({
    color: 0xCCCCCC,
    shininess: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // mesh.castShadow = false;
  mesh.receiveShadow = true;

  return mesh;
})();
container.add(floorBaseMesh);

function mod(a, n) {
  return ((a%n)+n)%n;
}
const floorMesh = (() => {
  const numTiles = 16;
  const numTiles2P1 = 2*numTiles+1;
  const planeBufferGeometry = new THREE.PlaneBufferGeometry(1, 1)
    .applyMatrix4(localMatrix.makeScale(0.95, 0.95, 1))
    .applyMatrix4(localMatrix.makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
    // .applyMatrix4(localMatrix.makeTranslation(0, 0.1, 0))
    .toNonIndexed();
  const numCoords = planeBufferGeometry.attributes.position.array.length;
  const numVerts = numCoords/3;
  const positions = new Float32Array(numCoords*numTiles2P1*numTiles2P1);
  const centers = new Float32Array(numCoords*numTiles2P1*numTiles2P1);
  const typesx = new Float32Array(numVerts*numTiles2P1*numTiles2P1);
  const typesz = new Float32Array(numVerts*numTiles2P1*numTiles2P1);
  let i = 0;
  for (let x = -numTiles; x <= numTiles; x++) {
    for (let z = -numTiles; z <= numTiles; z++) {
      const newPlaneBufferGeometry = planeBufferGeometry.clone()
        .applyMatrix4(localMatrix.makeTranslation(x, 0, z));
      positions.set(newPlaneBufferGeometry.attributes.position.array, i * newPlaneBufferGeometry.attributes.position.array.length);
      for (let j = 0; j < newPlaneBufferGeometry.attributes.position.array.length/3; j++) {
        localVector.set(x, 0, z).toArray(centers, i*newPlaneBufferGeometry.attributes.position.array.length + j*3);
      }
      let typex = 0;
      if (mod((x + parcelSize/2), parcelSize) === 0) {
        typex = 1/8;
      } else if (mod((x + parcelSize/2), parcelSize) === parcelSize-1) {
        typex = 2/8;
      }
      let typez = 0;
      if (mod((z + parcelSize/2), parcelSize) === 0) {
        typez = 1/8;
      } else if (mod((z + parcelSize/2), parcelSize) === parcelSize-1) {
        typez = 2/8;
      }
      for (let j = 0; j < numVerts; j++) {
        typesx[i*numVerts + j] = typex;
        typesz[i*numVerts + j] = typez;
      }
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('typex', new THREE.BufferAttribute(typesx, 1));
  geometry.setAttribute('typez', new THREE.BufferAttribute(typesz, 1));
  /* const geometry = new THREE.PlaneBufferGeometry(300, 300, 300, 300)
    .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)))); */
  const floorVsh = `
    #define PI 3.1415926535897932384626433832795
    uniform float uAnimation;
    attribute vec3 center;
    attribute float typex;
    attribute float typez;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;

    float range = 1.0;

    void main() {
      float animationRadius = uAnimation * ${numTiles.toFixed(8)};
      float currentRadius = length(center.xz);
      float radiusDiff = abs(animationRadius - currentRadius);
      float height = max((range - radiusDiff)/range, 0.0);
      height = sin(height*PI/2.0);
      height *= 0.2;
      // height = 0.0;
      vec3 p = vec3(position.x, position.y + height, position.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      vPosition = position + vec3(0.5, 0.0, 0.5);
      vTypex = typex;
      vTypez = typez;
      vDepth = gl_Position.z / ${numTiles.toFixed(8)};
    }
  `;
  const floorFsh = `
    uniform vec4 uCurrentParcel;
    uniform vec4 uHoverParcel;
    uniform vec4 uSelectedParcel;
    uniform vec3 uSelectedColor;
    // uniform float uAnimation;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;
    void main() {
      vec3 c;
      float a;
      if (
        vPosition.x >= uSelectedParcel.x &&
        vPosition.z >= uSelectedParcel.y &&
        vPosition.x <= uSelectedParcel.z &&
        vPosition.z <= uSelectedParcel.w
      ) {
        c = uSelectedColor;
      } else {
        c = vec3(0.9);
        // c = vec3(0.3);
      }
      float add = 0.0;
      if (
        vPosition.x >= uHoverParcel.x &&
        vPosition.z >= uHoverParcel.y &&
        vPosition.x <= uHoverParcel.z &&
        vPosition.z <= uHoverParcel.w
      ) {
        add = 0.2;
      } else {
        vec3 f = fract(vPosition);
        if (vTypex >= 2.0/8.0) {
          if (f.x >= 0.8) {
            add = 0.2;
          }
        } else if (vTypex >= 1.0/8.0) {
          if (f.x <= 0.2) {
            add = 0.2;
          }
        }
        if (vTypez >= 2.0/8.0) {
          if (f.z >= 0.8) {
            add = 0.2;
          }
        } else if (vTypez >= 1.0/8.0) {
          if (f.z <= 0.2) {
            add = 0.2;
          }
        }
        /* if (
          vPosition.x >= uCurrentParcel.x &&
          vPosition.z >= uCurrentParcel.y &&
          vPosition.x <= uCurrentParcel.z &&
          vPosition.z <= uCurrentParcel.w
        ) {
          add = 0.2;
        } */
      }
      c += add;
      a = (1.0-vDepth)*0.5;
      gl_FragColor = vec4(c, a);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      /* uTex: {
        type: 't',
        value: new THREE.Texture(),
      }, */
      uCurrentParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uHoverParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uSelectedParcel: {
        type: 'v4',
        value: new THREE.Vector4(-8, -8, 8, 8),
      },
      uSelectedColor: {
        type: 'c',
        value: new THREE.Color().setHex(0x5c6bc0),
      },
      uAnimation: {
        type: 'f',
        value: 0,
      },
    },
    vertexShader: floorVsh,
    fragmentShader: floorFsh,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // mesh.castShadow = true;
  // mesh.receiveShadow = true;
  return mesh;
})();
floorMesh.position.set(-8, 0, -8);
container.add(floorMesh);

const depthMaterial = (() => {
  const depthVsh = `
    // uniform float uAnimation;
    // attribute float typex;
    // varying vec3 vPosition;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }
  `;
  const depthFsh = `
    uniform float uNear;
    uniform float uFar;

    /* vec4 encodePixelDepth( float v ) {
      vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
      enc = fract(enc);
      // enc -= enc.xyzw * vec4(1.0/255.0,1.0/255.0,1.0/255.0,1.0/255.0);
      return enc;
    } */
    // const float infinity = 1./0.;
    vec4 encodePixelDepth( float v ) {
      float x = fract(v);
      v -= x;
      v /= 255.0;
      float y = fract(v);
      v -= y;
      v /= 255.0;
      float z = fract(v);
      /* v -= y;
      v /= 255.0;
      float w = fract(v);
      float w = 0.0;
      if (x == 0.0 && y == 0.0 && z == 0.0 && w == 0.0) {
        return vec4(0.0, 0.0, 0.0, 1.0);
      } else { */
        return vec4(x, y, z, 0.0);
      // }
    }
    void main() {
      float originalZ = uNear + gl_FragCoord.z / gl_FragCoord.w * (uFar - uNear);
      gl_FragColor = encodePixelDepth(originalZ);
    }
  `;
  return new THREE.ShaderMaterial({
    uniforms: {
      uNear: {
        type: 'f',
        value: 0,
      },
      uFar: {
        type: 'f',
        value: 0,
      },
    },
    vertexShader: depthVsh,
    fragmentShader: depthFsh,
    // transparent: true,
  });
})();

const voxelsGeometry = (() => {
  const cubeGeometry = new THREE.BoxBufferGeometry(voxelSize, voxelSize, voxelSize)
    .toNonIndexed();
  const cubeBarycentrics = new Float32Array(cubeGeometry.attributes.position.array.length/3*4);
  for (let i = 0; i < cubeBarycentrics.length/(2*6); i++) {
    cubeBarycentrics[i*12] = 0;
    cubeBarycentrics[i*12+1] = 1;

    cubeBarycentrics[i*12+2] = 0;
    cubeBarycentrics[i*12+3] = 0;

    cubeBarycentrics[i*12+4] = 1;
    cubeBarycentrics[i*12+5] = 1;

    cubeBarycentrics[i*12+6] = 0;
    cubeBarycentrics[i*12+7] = 0;

    cubeBarycentrics[i*12+8] = 1;
    cubeBarycentrics[i*12+9] = 0;

    cubeBarycentrics[i*12+10] = 1;
    cubeBarycentrics[i*12+11] = 1;
  }
  cubeGeometry.setAttribute('barycentric', new THREE.BufferAttribute(cubeBarycentrics, 2));
  const positions = new Float32Array(cubeGeometry.attributes.position.array.length*width*height*depth);
  const barycentrics = new Float32Array(cubeGeometry.attributes.barycentric.array.length*width*height*depth);
  const coords = new Float32Array(cubeGeometry.attributes.position.array.length*width*height*depth);
  const positionCenters = new Float32Array(cubeGeometry.attributes.position.array.length*width*height*depth);
  let i = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        const newCubeGeometry = cubeGeometry.clone()
          .applyMatrix4(localMatrix.makeTranslation(x*voxelSize, y*voxelSize, z*voxelSize));
        positions.set(newCubeGeometry.attributes.position.array, i*newCubeGeometry.attributes.position.array.length);
        barycentrics.set(newCubeGeometry.attributes.barycentric.array, i*newCubeGeometry.attributes.barycentric.array.length);
        const offset = Float32Array.from([x, y, z]);
        for (let j = 0; j < newCubeGeometry.attributes.position.array.length/3; j++) {
          coords.set(offset, i*newCubeGeometry.attributes.position.array.length + j*3);
        }
        const center = Float32Array.from([x*voxelSize + 0.5*voxelSize, y*voxelSize + 0.5*voxelSize, z*voxelSize + 0.5*voxelSize]);
        for (let j = 0; j < newCubeGeometry.attributes.position.array.length/3; j++) {
          positionCenters.set(center, i*newCubeGeometry.attributes.position.array.length + j*3);
        }
        i++;
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 2));
  geometry.setAttribute('coord', new THREE.BufferAttribute(coords, 3));
  geometry.setAttribute('positionCenter', new THREE.BufferAttribute(positionCenters, 3));
  return geometry;
})();
const marchCubesMaterial = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `\
    attribute vec3 barycentric;
    varying vec3 vPosition;
    varying vec3 vBC;
    void main() {
      vBC = barycentric;
      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      vPosition = modelViewPosition.xyz;
      gl_Position = projectionMatrix * modelViewPosition;
    }
  `,
  fragmentShader: `\
    uniform sampler2D uCameraTex;
    varying vec3 vPosition;
    varying vec3 vBC;

    vec3 color = vec3(0.984313725490196, 0.5490196078431373, 0.0);
    vec3 lightDirection = vec3(0.0, 0.0, 1.0);

    float edgeFactor() {
      vec3 d = fwidth(vBC);
      vec3 a3 = smoothstep(vec3(0.0), d*1.5, vBC);
      return min(min(a3.x, a3.y), a3.z);
    }

    void main() {
      float barycentricFactor = (0.2 + (1.0 - edgeFactor()) * 0.8);
      vec3 xTangent = dFdx( vPosition );
      vec3 yTangent = dFdy( vPosition );
      vec3 faceNormal = normalize( cross( xTangent, yTangent ) );
      float lightFactor = dot(faceNormal, lightDirection);
      gl_FragColor = vec4((0.5 + color * barycentricFactor) * lightFactor, 0.5 + barycentricFactor * 0.5);
      // gl_FragColor = vec4((0.5 + color * barycentricFactor) * lightFactor, 1.0);
    }
  `,
  // side: THREE.BackSide,
  /* polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -4, */
  transparent: true,
  // depthWrite: false,
  extensions: {
    derivatives: true,
  },
});

const cameraSize = 512;
const cameraTarget = new THREE.WebGLRenderTarget(cameraSize, cameraSize, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  // type: THREE.FloatType,
  depthBuffer: true,
  stencilBuffer: false,
});

const volumeTargetGeometry = (() => {
  const edgeWidth = 0.01;
  const edgeGeometry = BufferGeometryUtils.mergeBufferGeometries([
    new THREE.BoxBufferGeometry(edgeWidth, 0.4, edgeWidth)
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0, -0.4/2, 0)),
    new THREE.BoxBufferGeometry(edgeWidth, 0.4, edgeWidth)
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 0.4/2)),
    new THREE.BoxBufferGeometry(edgeWidth, 0.4, edgeWidth)
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.4/2, 0, 0)),
  ]);
  const portalTargetGeometry = BufferGeometryUtils.mergeBufferGeometries([
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, 0.5, 0)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, 0)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, 0.5, 1)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0.5, 0)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0.5, 1)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, 1)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0))))
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0))))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, -0.5, 0)),
    edgeGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 1, 0).normalize(), new THREE.Vector3(1, -1, 0).normalize())))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, -0.5, 1)),
  ]);
  return BufferGeometryUtils.mergeBufferGeometries([
    portalTargetGeometry
      .clone()
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5)),
    new THREE.BoxBufferGeometry(0.1, edgeWidth, edgeWidth),
    new THREE.BoxBufferGeometry(edgeWidth, 0.05, edgeWidth).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.05/2, 0)),
    new THREE.BoxBufferGeometry(edgeWidth, edgeWidth, 0.05).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.05/2)),
  ]);
})();
const volumeMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(0x333333),
  /* transparent: true,
  opacity: 0.1, */
});
const _makeVolumeMesh = () => {
  const mesh = new THREE.Mesh(volumeTargetGeometry, volumeMaterial);
  mesh.frustumCulled = false;
  return mesh;
};

const raycasterCamera = new THREE.PerspectiveCamera();
const _hideUiMeshes = () => {
  const unhideXrChunks = xrChunker.chunks.map(chunk => {
    const oldVolumeMeshVisible = chunk.volumeMesh.visible;
    chunk.volumeMesh.visible = false;
    const oldVoxelsMeshVisible = chunk.voxelsMesh.visible;
    chunk.voxelsMesh.visible = false;
    const oldMarchCubesMeshVisible = chunk.marchCubesMesh.visible;
    chunk.marchCubesMesh.visible = false;
    return () => {
      chunk.volumeMesh.visible = oldVolumeMeshVisible;
      chunk.voxelsMesh.visible = oldVoxelsMeshVisible;
      chunk.marchCubesMesh.visible = oldMarchCubesMeshVisible;
    };
  });

  return () => {
    for (let i = 0; i < unhideXrChunks.length; i++) {
      unhideXrChunks[i]();
    }
  };
};
const _renderRaycaster = ({target, near, far, matrixWorld, projectionMatrix}) => {
  raycasterCamera.near = near;
  raycasterCamera.far = far;
  raycasterCamera.matrixWorld.fromArray(matrixWorld).decompose(raycasterCamera.position, raycasterCamera.quaternion, raycasterCamera.scale);
  raycasterCamera.projectionMatrix.fromArray(projectionMatrix);
  depthMaterial.uniforms.uNear.value = near;
  depthMaterial.uniforms.uFar.value = far;

  {
    const unhideUiMeshes = _hideUiMeshes();

    scene.overrideMaterial = depthMaterial;
    const oldVrEnabled = renderer.xr.enabled;
    renderer.xr.enabled = false;
    const oldClearColor = localColor.copy(renderer.getClearColor());
    const oldClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(localColor2.setRGB(0, 0, 0), 1);
    renderer.setRenderTarget(target);

    renderer.render(scene, raycasterCamera);

    scene.overrideMaterial = null;
    renderer.xr.enabled = oldVrEnabled;
    renderer.setClearColor(oldClearColor, oldClearAlpha);

    unhideUiMeshes();

    renderer.setRenderTarget(null);
  }
};
const xrRaycaster = new XRRaycaster({
  width: colorTargetSize,
  height: colorTargetSize,
  renderer,
  fov,
  aspect,
  near: raycastNear,
  far: raycastFar,
  depth: raycastDepth,
  onRender: _renderRaycaster,
});
xrRaycaster.updateView(
  [-0.5, 0.5, -1],
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI*0.2)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI*0.1))
    .toArray()
);
const xrChunker = new XRChunker();
xrChunker.addEventListener('addchunk', e => {
  const {data: chunk} = e;

  container.add(chunk.object);

  const volumeMesh = _makeVolumeMesh();
  // chunk.object.add(volumeMesh);
  chunk.volumeMesh = volumeMesh;

  const potentialsTexture = new THREE.DataTexture(null, (width+1)*(height+1)*(depth+1), 1, THREE.RedFormat, THREE.FloatType, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.NearestFilter, THREE.NearestFilter);
  chunk.potentialsTexture = potentialsTexture;
  /* const voxelsMaterial = (() => {
    const voxelsVsh = `
      attribute vec3 coord;
      attribute vec2 barycentric;
      uniform sampler2D uPotentialsTex;
      // varying float vPotential;
      varying vec2 vBC;
      varying vec3 vPosition;
      void main() {
        float ux = (coord.x + coord.y*${((width+1)*(depth+1)).toFixed(8)} + coord.z*${(width+1).toFixed(8)} + 0.5) / ${((width+1)*(height+1)*(depth+1)).toFixed(8)};
        vec2 uv = vec2(ux, 0.5);
        float potential = texture2D(uPotentialsTex, uv).r;
        vBC = barycentric;
        if (potential > 0.0) {
          vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
          vPosition = modelViewPosition.xyz;
          gl_Position = projectionMatrix * modelViewPosition;
        } else {
          gl_Position = vec4(0.0);
        }
      }
    `;
    const voxelsFsh = `
      // varying float vPotential;
      varying vec2 vBC;
      varying vec3 vPosition;

      vec3 color = vec3(0.984313725490196, 0.5490196078431373, 0.0);
      vec3 lightDirection = vec3(0.0, 0.0, 1.0);

      float edgeFactor() {
        float f = 0.0;
        if (vBC.x <= 0.02) {
          f = max(1.0, f);
        } else {
          f = max(1.0 - (vBC.x-0.02)/0.02, f);
        }
        if (vBC.x >= 0.98) {
          f = max(1.0, f);
        } else {
          f = max((vBC.x-0.96)/0.02, f);
        }
        if (vBC.y <= 0.02) {
          f = max(1.0, f);
        } else {
          f = max(1.0 - (vBC.y-0.02)/0.02, f);
        }
        if (vBC.y >= 0.98) {
          f = max(1.0, f);
        } else {
          f = max((vBC.y-0.96)/0.02, f);
        }
        return f;
      }

      void main() {
        float barycentricFactor = (0.2 + edgeFactor() * 0.8);
        vec3 xTangent = dFdx( vPosition );
        vec3 yTangent = dFdy( vPosition );
        vec3 faceNormal = normalize( cross( xTangent, yTangent ) );
        float lightFactor = dot(faceNormal, lightDirection);
        gl_FragColor = vec4((0.5 + color * barycentricFactor) * lightFactor, 0.5 + barycentricFactor * 0.5);
        // gl_FragColor = vBC;
        // gl_FragColor.a = 1.0;
        // gl_FragColor = vec4(color, vPotential);
      }
    `;
    return new THREE.ShaderMaterial({
      uniforms: {
        uPotentialsTex: {
          type: 't',
          value: potentialsTexture,
        },
      },
      vertexShader: voxelsVsh,
      fragmentShader: voxelsFsh,
      transparent: true,
      // depthWrite: false,
      extensions: {
        derivatives: true,
      },
    });
  })();
  chunk.voxelsMaterial = voxelsMaterial; */
  const voxelsTexturedMaterial = (() => {
    const voxelsVsh = `
      attribute vec3 coord;
      attribute vec3 positionCenter;
      uniform sampler2D uPotentialsTex;
      uniform sampler2D uCameraTex;
      // varying float vPotential;
      varying vec3 vPosition;
      varying vec4 vColor;
      void main() {
        float ux = (coord.x + coord.y*${((width+1)*(depth+1)).toFixed(8)} + coord.z*${(width+1).toFixed(8)} + 0.5) / ${((width+1)*(height+1)*(depth+1)).toFixed(8)};
        vec2 voxelUv = vec2(ux, 0.5);
        float potential = texture2D(uPotentialsTex, voxelUv).r;
        if (potential > 0.0) {
          vec4 projectionPositionCenter = projectionMatrix * modelViewMatrix * vec4(positionCenter, 1.0);
          vec3 screenPosition = (projectionPositionCenter.xyz/projectionPositionCenter.w)/2.0+0.5;
          vec2 uv = screenPosition.xy;
          vColor = texture2D(uCameraTex, uv);
          // vColor = vec4(1.0, 0.0, 1.0, 1.0);

          vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
          vPosition = modelViewPosition.xyz;
          gl_Position = projectionMatrix * modelViewPosition;
        } else {
          gl_Position = vec4(0.0);
        }
      }
    `;
    const voxelsFsh = `
      uniform sampler2D uCameraTex;
      // varying float vPotential;
      varying vec3 vPosition;
      varying vec4 vColor;

      vec3 lightDirection = vec3(0.0, 0.0, 1.0);

      void main() {
        vec3 xTangent = dFdx( vPosition );
        vec3 yTangent = dFdy( vPosition );
        vec3 faceNormal = normalize( cross( xTangent, yTangent ) );
        float lightFactor = dot(faceNormal, lightDirection);

        gl_FragColor.rgb = vColor.rgb * lightFactor;
        gl_FragColor.a = 1.0;
      }
    `;
    return new THREE.ShaderMaterial({
      uniforms: {
        uPotentialsTex: {
          type: 't',
          value: potentialsTexture,
        },
        uCameraTex: {
          type: 't',
          value: cameraTarget.texture,
        },
      },
      vertexShader: voxelsVsh,
      fragmentShader: voxelsFsh,
      // transparent: true,
      extensions: {
        derivatives: true,
      },
    });
  })();
  chunk.voxelsTexturedMaterial = voxelsTexturedMaterial;

  const voxelsMesh = (() => {
    const geometry = voxelsGeometry;
    // const material = voxelsMaterial;
    const material = voxelsTexturedMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.needsUpload = false;
    mesh.update = potentials => {
      potentialsTexture.image.data = potentials;

      mesh.visible = true;

      mesh.needsUpload = true;
      potentialsTexture.needsUpdate = true;
      potentialsTexture.onUpdate = () => {
        mesh.needsUpload = false;
        potentialsTexture.onUpdate = null;
      };
    };
    return mesh;
  })();
  voxelsMesh.visible = false;
  chunk.object.add(voxelsMesh);
  chunk.voxelsMesh = voxelsMesh;

  /* const marchCubesRenderTarget = new THREE.WebGLRenderTarget(marchCubesTexSize, marchCubesTexSize, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    // type: THREE.FloatType,
    depthBuffer: true,
    stencilBuffer: false,
  });

  const marchCubesTexturedMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMarchCubesTex: {
        type: 't',
        value: marchCubesRenderTarget.texture,
      },
    },
    vertexShader: `\
      attribute vec3 barycentric;
      attribute vec2 uv2;
      varying vec2 vUv;
      void main() {
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewPosition;
        vUv = uv2;
      }
    `,
    fragmentShader: `\
      uniform sampler2D uMarchCubesTex;
      varying vec2 vUv;

      void main() {
        gl_FragColor = texture2D(uMarchCubesTex, vUv);
        gl_FragColor.rgb += 0.2;
        gl_FragColor.a = 1.0;
      }
    `,
    transparent: true,
  });
  chunk.marchCubesTexturedMaterial = marchCubesTexturedMaterial; */
  const marchCubesMesh = (() => {
    const geometry = new THREE.BufferGeometry();
    const material = marchCubesMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(1, 1, 1).multiplyScalar(voxelSize);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.needsUpload = false;
    mesh.update = (positions, barycentrics, uvs, uvs2) => {
      if (positions.length > 0) {
        const positionsAttribute = new THREE.BufferAttribute(positions, 3);
        geometry.setAttribute('position', positionsAttribute);
        geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentrics, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('uv2', new THREE.BufferAttribute(uvs2, 2));

        mesh.needsUpload = true;
        positionsAttribute.onUploadCallback = () => {
          mesh.needsUpload = false;
          positionsAttribute.onUploadCallback = null;
        };

        mesh.visible = true;

        /* if (meshingTextureSwitchWrap.classList.contains('on')) {
          const unhideUiMeshes = _hideUiMeshes();

          renderer.setRenderTarget(marchCubesRenderTarget);
          renderer.autoClear = false;
          renderer.render(marchCubesRenderScene, camera);
          renderer.autoClear = true;

          unhideUiMeshes();
          renderer.setRenderTarget(null);
        } */
      } else {
        mesh.visible = false;
      }
    };
    return mesh;
  })();
  marchCubesMesh.visible = false;
  chunk.object.add(marchCubesMesh);
  chunk.marchCubesMesh = marchCubesMesh;

  /* const marchCubesRenderMesh = (() => {
    const {geometry} = marchCubesMesh;
    const material = marchCubesRenderMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(chunk.object.position);
    mesh.scale.copy(marchCubesMesh.scale);
    mesh.frustumCulled = false;
    return mesh;
  })();
  const marchCubesRenderScene = new THREE.Scene();
  marchCubesRenderScene.add(marchCubesRenderMesh); */

  chunk.addEventListener('update', e => {
    const {data: {potentials, positions, barycentrics, uvs, uvs2}} = e;
    if (chunk.object.position.x > -1) {
      voxelsMesh.update(potentials);
    } else {
      marchCubesMesh.update(positions, barycentrics, uvs, uvs2);
    }
  });
});
xrChunker.addEventListener('removechunk', e => {
  const {data: chunk} = e;

  chunk.potentialsTexture.dispose();
  chunk.marchCubesMesh.geometry.dispose();
  // chunk.voxelsMaterial.dispose();
  chunk.voxelsTexturedMaterial.dispose();
  // chunk.marchCubesTexturedMaterial.dispose();

  container.remove(chunk.object);
});
xrChunker.updateTransform(
  [-1, 1, -2],
  [0, 0, 0, 1],
  [2, 2, 2]
);

const boxGeometry = (() => {
  const BAG_SIZE = 1;
  const BAG_Y_OFFSET = -0.5;
  const BAG_Z_OFFSET = -0.05;

  const _decomposeObjectMatrixWorld = object => _decomposeMatrix(object.matrixWorld);
  const _decomposeMatrix = matrix => {
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, rotation, scale);
    return {position, rotation, scale};
  };

  const lineGeometry = new THREE.CylinderBufferGeometry(BAG_SIZE/100, BAG_SIZE/100, BAG_SIZE, 3, 1);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(lineGeometry.attributes.position.array.length * 12);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // axis
  positions.set(
    lineGeometry.clone().applyMatrix4(
      localMatrix.makeTranslation(-BAG_SIZE/2, 0, -BAG_SIZE/2)
    ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 0
  );
  positions.set(
    lineGeometry.clone().applyMatrix4(
      localMatrix.makeTranslation(BAG_SIZE/2, 0, -BAG_SIZE/2)
    ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 1
  );
  positions.set(
    lineGeometry.clone().applyMatrix4(
      localMatrix.makeTranslation(-BAG_SIZE/2, 0, BAG_SIZE/2)
    ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 2
  );
  positions.set(
    lineGeometry.clone().applyMatrix4(
      localMatrix.makeTranslation(BAG_SIZE/2, 0, BAG_SIZE/2)
    ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 3
  );
  // axis
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(0, -BAG_SIZE/2, -BAG_SIZE/2)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 4
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(0, -BAG_SIZE/2, BAG_SIZE/2)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 5
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(0, BAG_SIZE/2, -BAG_SIZE/2)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 6
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(0, 0, 1), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(0, BAG_SIZE/2, BAG_SIZE/2)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 7
  );
  // axis
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(-BAG_SIZE/2, -BAG_SIZE/2, 0)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 8
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(-BAG_SIZE/2, BAG_SIZE/2, 0)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 9
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(BAG_SIZE/2, -BAG_SIZE/2, 0)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 10
  );
  positions.set(
    lineGeometry.clone()
      .applyMatrix4(
        localMatrix.makeRotationFromQuaternion(localQuaternion.setFromAxisAngle(localVector.set(1, 0, 0), Math.PI/2))
      )
      .applyMatrix4(
        localMatrix.makeTranslation(BAG_SIZE/2, BAG_SIZE/2, 0)
      ).attributes.position.array,
    lineGeometry.attributes.position.array.length * 11
  );
  const numLinePositions = lineGeometry.attributes.position.array.length / 3;
  const indices = new Uint16Array(lineGeometry.index.array.length * 12);
  for (let i = 0; i < 12; i++) {
    indices.set(
      lineGeometry.index.array,
      lineGeometry.index.array.length * i
    );

    for (let j = 0; j < lineGeometry.index.array.length; j++) {
      lineGeometry.index.array[j] += numLinePositions;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  return geometry;
})();

/* const boxMesh = (() => {
  // const geometry = new THREE.BoxBufferGeometry(0.3, 0.3, 0.3);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    // wireframe: true,
  });
  const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(0.3, 0.3, 0.3)), material);

  const glassesMesh = (() => {
    // const geometry = new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(0.35, 0.15, 0.05));
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      // wireframe: true,
    });
    const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(0.35, 0.15, 0.05)), material);
    mesh.position.set(0, 0.07, -0.3/2 - 0.05/2);

    const eyeMesh = (() => {
      const geometry = new THREE.PlaneBufferGeometry(0.3, 0.1);
      const material = new THREE.MeshBasicMaterial({
        color: 0xec407a,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      // mesh.position.set(0.09, 0, -0.05/2);
      mesh.position.set(0, 0, -0.05/2);
      return mesh;
    })();
    mesh.add(eyeMesh);

    const leftFrameMesh = (() => {
      const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(0.05, 0.05, 0.3)), material);
      mesh.position.set(-0.18, 0.07, 0.3/2 + 0.05/2);
      mesh.rotation.x = -0.1 * Math.PI;
      mesh.rotation.order = 'YXZ';
      return mesh;
    })();
    mesh.add(leftFrameMesh);
    const rightFrameMesh = (() => {
      const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(0.05, 0.05, 0.3)), material);
      mesh.position.set(0.18, 0.07, 0.3/2 + 0.05/2);
      mesh.rotation.x = -0.1 * Math.PI;
      mesh.rotation.order = 'YXZ';
      return mesh;
    })();
    mesh.add(rightFrameMesh);
    const backFrameMesh = (() => {
      const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(0.3, 0.05, 0.05)), material);
      mesh.position.set(0, 0.13, 0.34);
      mesh.rotation.x = -0.1 * Math.PI;
      mesh.rotation.order = 'YXZ';
      return mesh;
    })();
    mesh.add(backFrameMesh);

    return mesh;
  })();
  mesh.add(glassesMesh);

  return mesh;
})();
container.add(boxMesh); */

const portalSize = 3;
const cornersGeometry = (() => {
  const cornersShape = new THREE.Shape();
  (function corners(ctx) {
    const size = 0.03;
    ctx.moveTo(-size, size);
    ctx.lineTo(size*2, size);
    ctx.lineTo(size*2, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, -size*2);
    ctx.lineTo(-size, -size*2);
  })(cornersShape);
  const cornerGeometry = new THREE.ShapeBufferGeometry(cornersShape);
  const cornersGeometry = BufferGeometryUtils.mergeBufferGeometries([
    cornerGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0)))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, 0.5, 0)),
    cornerGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2)))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, 0.5, 0)),
    cornerGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2*2)))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(0.5, -0.5, 0)),
    cornerGeometry.clone()
      .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2*3)))
      .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.5, -0.5, 0))
  ]);
  // cornersGeometry.computeBoundingBox();
  // cornersGeometry.boundingBox.min.z = -0.01;
  // cornersGeometry.boundingBox.max.z = 0.01;
  return cornersGeometry;
})();
const tabMesh1 = (() => {
  const geometry = cornersGeometry.clone()
    .applyMatrix4(new THREE.Matrix4().makeScale(portalSize, portalSize, 1));
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    // wireframe: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(1, 1.5, -4);

  /* const labelMesh = (() => {
    const geometry = new THREE.PlaneBufferGeometry(1, 0.2);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024 * 0.2;
    // canvas.style.backgroundColor = 'red';
    const ctx = canvas.getContext('2d');
    ctx.font = '140px -apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
    ctx.fillText('http://A-Frame', 0, 150);
    // window.document.body.appendChild(canvas);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.7;
    return mesh;
  })();
  mesh.add(labelMesh); */

  return mesh;
})();
container.add(tabMesh1);

const innerMesh = (() => {
  const geometry = new THREE.PlaneBufferGeometry(portalSize, portalSize);
  const mesh = new Reflector(geometry, {
    clipBias: 0.003,
    textureWidth: 1024 * window.devicePixelRatio,
    textureHeight: 1024 * window.devicePixelRatio,
    color: 0x889999,
    addColor: 0x300000,
    recursion: 1,
  });
  // mesh.position.set(-1, 1.5, -2.1);
  // mesh.position.set(-3, 1.5, -1.5);
  mesh.position.copy(tabMesh1.position)
    // .add(new THREE.Vector3(0, 0, 0.001).applyQuaternion(tabMesh1.quaternion));
  /* mesh.rotation.order = 'YXZ';
  mesh.rotation.y = Math.PI; */
  /* const material = new THREE.MeshBasicMaterial({
    color: 0xFF0000,
  });
  const mesh = new THREE.Mesh(geometry, material); */
  return mesh;
})();
container.add(innerMesh);

/* const tabMesh2 = (() => {
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    // wireframe: true,
  });
  const mesh = new THREE.Mesh(boxGeometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 0.4)), material);
  mesh.position.set(0.5, 1.5, -1);
  mesh.rotation.y = -0.25*Math.PI;
  mesh.rotation.order = 'YXZ';

  return mesh;
})();
container.add(tabMesh2); */

const meteorMesher = new THREE.Object3D();
meteorMesher.nextUpdateTime = 0;
meteorMesher.meteorMeshes = [];
container.add(meteorMesher);

app.object.add(container);

const _makeMeteorMaterial = src => {
  const texture = new THREE.Texture(
    null,
    THREE.UVWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.LinearFilter,
    THREE.LinearMipMapLinearFilter,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    16
  );
  new Promise((accept, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = src;
    img.onload = () => {
      accept(img);
    };
    img.onerror = err => {
      reject(err);
    };
  })
    .then(img => {
      texture.image = img;
      texture.needsUpdate = true;
    });
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.5,
  });
  return material;
};
const METEORS = [
  {geometry: new THREE.PlaneBufferGeometry(0.6, 0.6), material: _makeMeteorMaterial(app.files['./assets/Group 17@2x.png'])},
  {geometry: new THREE.PlaneBufferGeometry(0.6, 0.6), material: _makeMeteorMaterial(app.files['./assets/Group 31@2x.png'])},
];
const _makeMeteorMesh = () => {
  const {geometry, material} = METEORS[Math.floor(Math.random() * METEORS.length)];

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(10 - 1, 10 + (Math.random()-0.5)*3, -1 + (Math.random()-0.5)*1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3((Math.random()-0.5)*0.2, 1, 0).normalize()
  );
  const scale = 0.5 + Math.random();
  mesh.scale.set(scale, scale, scale);
  mesh.speed = 0.3 + Math.random()*0.3;
  // mesh.castShadow = true;

  return mesh;
};
let lastUpdateTime = Date.now();
function animate(timestamp, frame, referenceSpace) {
  const now = Date.now();
  const timeDiff = now - lastUpdateTime;

  if (now > meteorMesher.nextUpdateTime) {
    const meteorMesh = _makeMeteorMesh();
    meteorMesher.add(meteorMesh);
    meteorMesher.meteorMeshes.push(meteorMesh);

    meteorMesher.nextUpdateTime = now + 0.3*1000;
  }
  meteorMesher.meteorMeshes = meteorMesher.meteorMeshes.filter(meteorMesh => {
    meteorMesh.position.add(localVector.set(
      1,
      1,
      0
    ).multiplyScalar(-0.005 * timeDiff * meteorMesh.speed).applyQuaternion(meteorMesh.quaternion));
    if (meteorMesh.position.y > -1/2) {
      return true;
    } else {
      meteorMesher.remove(meteorMesh);
      return false;
    }
  });

  floorMesh.material.uniforms.uAnimation.value = (now%2000)/2000;

  {
    app.onBeforeRender();
    const unhideUiMeshes = _hideUiMeshes();

    renderer.setRenderTarget(cameraTarget);
    renderer.render(scene, camera);

    unhideUiMeshes();
    app.onAfterRender();
    renderer.setRenderTarget(null);
  }

  // gpuParticlesMesh.update();
  xrChunker.updateMesh(async () => {
    // xrRaycaster.updateView(camera.position.toArray(), camera.quaternion.toArray());
    xrRaycaster.updateTexture();
    await XRRaycaster.nextFrame();
    xrRaycaster.updateDepthBuffer();
    xrRaycaster.updatePointCloudBuffer();
    return {
      width: xrRaycaster.width,
      voxelSize,
      marchCubesTexSize,
      pointCloudBuffer: xrRaycaster.getPointCloudBuffer(),
    };
  });

  // renderer.render(scene, camera);
  xrRaycaster.render();
  xrChunker.render();

  lastUpdateTime = now;
}
renderer.setAnimationLoop(animate);

})();