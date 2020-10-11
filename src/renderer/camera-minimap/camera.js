import {
  Vector3,
  MOUSE,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLCubeRenderTarget,
  CubeCamera,
} from "three";
import { OrbitControls } from "../utils/OrbitalControls";

//zoom in tighter allowed as teh angle is closer to 90deg above
// rotating angle will then zoom out if outside the limit

export const initCameraControls = (camera, element, limitControl = false) => {
  const orbitControl = new OrbitControls(camera, element);
  orbitControl.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE,
  };
  if (limitControl) {
    orbitControl.panSpeed = 2;
    orbitControl.rotateSpeed = 0.4;
    orbitControl.maxDistance = 80;
    orbitControl.minDistance = 15;
    orbitControl.enableDamping = true;
    orbitControl.dampingFactor = 0.2;
    orbitControl.keyPanSpeed = 50;
    orbitControl.zoomSpeed = 1;

    orbitControl.maxPolarAngle = Math.PI / 3;
    // option to disable for 360 view
    orbitControl.maxAzimuthAngle = Math.PI / 5;
    orbitControl.minAzimuthAngle = -Math.PI / 5;
    // camera.position.clampLength(5, 60);
  }
  orbitControl.screenSpacePanning = false;
  orbitControl.update();
  return orbitControl;
};

export const initCamera = (domElement, limitControl = false) => {
  // const camera = orthoCamera();
  const camera = perspectiveCamera();
  return [camera, initCameraControls(camera, domElement, limitControl)];
};

const orthoCamera = () => {
  const camera = new OrthographicCamera(16, 0, 16, 0, 1, 10000);

  return camera;
};

const perspectiveCamera = () => {
  const camera = new PerspectiveCamera(
    30,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  window.camera = camera;
  camera.position.set(0, 200, 0);
  camera.lookAt(new Vector3());
  return camera;
};

export const initCubeCamera = (renderer, map) => {
  const cubeRenderTargetGenerator = new WebGLCubeRenderTarget(128, {});

  const renderTarget = cubeRenderTargetGenerator.fromEquirectangularTexture(
    renderer,
    map
  );
  cubeRenderTargetGenerator.dispose();
  const cubeCamera = new CubeCamera(1, 100000, renderTarget);
  return cubeCamera;
};
