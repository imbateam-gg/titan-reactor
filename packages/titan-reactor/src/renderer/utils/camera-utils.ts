import CameraControls from "camera-controls";
import { PerspectiveCamera, Vector3 } from "three";
import { easePoly, easeExpIn } from "d3-ease";

export const getDirection32 = (target: Vector3, cameraPosition: Vector3) => {
  const adj = target.z - cameraPosition.z;
  const opp = target.x - cameraPosition.x;
  const a = Math.atan2(opp, adj) / Math.PI;

  if (a < 0) {
    return Math.floor((a + 2) * 16 + 16);
  } else {
    return Math.floor(a * 16 + 16);
  }
}

export const POLAR_MAX = (10 * Math.PI) / 64;
export const POLAR_MIN = (2 * Math.PI) / 64;
export const AZI_RANGE = (20 * Math.PI) / 64;

export const constrainControls = (controls: CameraControls, maxMapDim: number) => {
  controls.maxDistance = maxMapDim * 0.8;
  controls.minDistance = 20;
  controls.dollySpeed = 0.2

  controls.maxPolarAngle = POLAR_MAX; // bottom
  controls.minPolarAngle = POLAR_MIN; // top
  controls.maxAzimuthAngle = 0//AZI_RANGE / 2;
  controls.minAzimuthAngle = 0//-AZI_RANGE / 2;
}

export const constrainAzimuth = (polarAngle: number) => {
  const np = (polarAngle - POLAR_MIN) / (POLAR_MAX - POLAR_MIN);
  return (np * np * AZI_RANGE);
}

export const getDOFFocalLength = (camera: PerspectiveCamera, polarAngle: number) => {
  const cy = (Math.max(20, Math.min(90, camera.position.y)) - 20) / 70;

  const cz = 1 - (Math.max(22, Math.min(55, camera.fov)) - 22) / 33;
  const min = cz * 0.2 + 0.1;

  const ey = easePoly(cy);
  const pa = 1 - Math.max(0.2, Math.min(1, 0)); // cameras.control.polarAngle));
  const cx = ey * pa;
  const o = cx * (1 - min) + min;

  return o;
}


const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

export function calculateVerticalFoV(horizontalFoV: number, aspect = 16 / 9) {

  return Math.atan(Math.tan(horizontalFoV * DEG2RAD * 0.5) / aspect) * RAD2DEG * 2.0;

}

export function calculateHorizontalFoV(verticalFoV: number, aspect = 16 / 9) {

  return Math.atan(Math.tan(verticalFoV * DEG2RAD * 0.5) * aspect) * RAD2DEG * 2.0;

}