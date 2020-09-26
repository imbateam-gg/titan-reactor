import * as THREE from "three";
import { initRenderer } from "../3d-map-rendering/renderer";
import { initCamera, initCubeCamera } from "../camera-minimap/camera";
import { handleResize } from "../utils/resize";
import { sunlight, fog } from "../3d-map-rendering/environment";
import { backgroundTerrainMesh } from "../3d-map-rendering/meshes/backgroundTerrainMesh";
import { bgMapCanvasTexture } from "../3d-map-rendering/textures/bgMapCanvasTexture";
import { Terrain } from "../3d-map-rendering/Terrain";
import { TextureCache } from "../3d-map-rendering/textures/TextureCache";

import { BWAPIFrameFromBuffer } from "./BWAPIFrames";
import { BgMusic } from "../audio/BgMusic";

import { ReplayUnits } from "./ReplayUnits";
import { getTerrainY } from "../3d-map-rendering/displacementGeometry";
import { disposeMeshes } from "../utils/meshes/dispose";
//todo refactor out
import { openFile, getAppCachePath } from "../invoke";
import { difference } from "ramda";

export const hot = module.hot ? module.hot.data : null;

export async function TitanReactorReplay(
  filepath,
  { header, commands, chk },
  renderUnit,
  canvas,
  bwDat,
  loaded
) {
  console.log(header, commands, chk);

  const infoDiv = document.createElement("div");
  infoDiv.style.top = "10px";
  infoDiv.style.left = "10px";
  infoDiv.style.position = "absolute";
  infoDiv.style.color = "white";
  document.body.appendChild(infoDiv);
  const appendInfoDiv = (str) => (infoDiv.innerHTML += str + "<br/>");
  const clearInfoDiv = () => (infoDiv.innerHTML = "");

  const scene = new THREE.Scene();

  let running = false;
  THREE.DefaultLoadingManager.onLoad = () => {
    loaded();
    running = true;
  };

  const sceneWidth = window.innerWidth;
  const sceneHeight = window.innerHeight;

  const renderer = initRenderer({
    canvas,
    width: sceneWidth,
    height: sceneHeight,
    antialias: true,
    shadowMap: true,
  });

  const [camera, cameraControls] = initCamera(renderer.domElement);
  if (hot && hot.camera) {
    camera.position.copy(hot.camera.position);
    camera.rotation.copy(hot.camera.rotation);
  }

  const gridHelper = new THREE.GridHelper(128, 128, 0xff0000, 0x009900);
  gridHelper.position.set(0, 6, 0);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.5;
  gridHelper.visible = false;
  scene.add(gridHelper);

  const light = sunlight(chk.size[0], chk.size[1]);
  scene.add(light);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 5);
  scene.add(hemi);

  const textureCache = new TextureCache(chk.title, await getAppCachePath());
  const terrainMesh = new Terrain(chk, textureCache);
  const terrain = await terrainMesh.generate();
  const bg = await bgMapCanvasTexture(chk);
  const bgTerrain = backgroundTerrainMesh(chk.size[0], chk.size[1], bg);

  scene.add(terrain);
  // @todo fix sprite black box issue
  // scene.add(bgTerrain);

  scene.fog = fog(chk.size[0], chk.size[1]);
  scene.background = scene.fog.color;

  const cubeCamera = initCubeCamera(renderer, terrain.material.map);
  scene.add(cubeCamera);

  const pointLight = new THREE.PointLight("0xffffff", 1, 60, 0);
  pointLight.power = 20;
  pointLight.castShadow = true;
  scene.add(pointLight);

  const audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  const bgMusic = new BgMusic(audioListener);
  bgMusic.setVolume(0.0);
  bgMusic.playGame();
  scene.add(bgMusic.getAudio());

  const terrainY = getTerrainY(
    terrain.userData.displacementMap.image
      .getContext("2d")
      .getImageData(
        0,
        0,
        terrain.userData.displacementMap.image.width,
        terrain.userData.displacementMap.image.height
      ),
    terrain.userData.displacementScale,
    chk.size[0],
    chk.size[1]
  );

  const units = new ReplayUnits(
    bwDat,
    renderUnit,
    terrainY,
    audioListener,
    {},
    openFile
  );
  scene.add(units.units);

  const cancelResize = handleResize(camera, renderer);

  let BWAPIFramesDataView = null;

  // const tempReplayFile = "./bwdata/_alex/0279 ScanKaLT azzyP.rep.bin";
  // const tempReplayFile = "./bwdata/_alex/CTR_F505F47D.rep.bin";
  // const tempReplayFile = "./bwdata/_alex/CTR_52C0564.rep.bin";
  const tempReplayFile = "./bwdata/_alex/0255 CleanNaraT simjeongZ.rep.bin";
  // 0006 ramiyerP ScanKaLT.rep.bin
  THREE.DefaultLoadingManager.itemStart(tempReplayFile);
  openFile(tempReplayFile).then((frames) => {
    BWAPIFramesDataView = new DataView(frames.buffer);
    THREE.DefaultLoadingManager.itemEnd(tempReplayFile);
  });

  let requestAnimationFrameId = null;

  let worldFrame = 0;
  let BWAPIFrameOffset = 0;
  let initialSkipGameFrames = hot ? hot.BWAPIFrame : 0;
  let numSkipGameFrames = 1;
  let gameFrame = 0;
  const physicsFrameSkip = 20;

  const keyDownListener = (e) => {
    if (e.code === "KeyP") {
      running = !running;
      console.log("BWAPIFrame", gameFrame);
    }

    if (e.code === "KeyG") {
      gridHelper.visible = !gridHelper.visible;
    }

    if (e.code === "KeyS") {
      if (numSkipGameFrames === 10) {
        numSkipGameFrames = 1;
      } else {
        numSkipGameFrames = 10;
      }
    }

    if (e.code === "Digit0") {
      resetTo = 0;
    }
  };
  let resetTo;
  window.goto = (frame) => (resetTo = frame);

  document.addEventListener("keydown", keyDownListener);

  const mouseDownListener = (event) => {
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(units.getUnits(), true);
    const getAsUnit = (mesh) => {
      if (!mesh) return null;
      if (mesh.userData && mesh.userData.typeId !== undefined) {
        return mesh;
      } else {
        return getAsUnit(mesh.parent);
      }
    };

    if (intersects[0]) {
      console.log("intersects", intersects[0]);
      const unit = getAsUnit(intersects[0].object);

      if (unit) {
        console.log(unit);
      }
    }
  };
  document.addEventListener("mousedown", mouseDownListener);

  let unitsLastFrame = [];
  let unitsThisFrame = [];
  function gameLoop() {
    worldFrame++;

    units.cameraUpdate(camera, cameraControls);

    //#region BWAPIFrames interpretation
    if (running && BWAPIFramesDataView) {
      if (resetTo !== undefined) {
        gameFrame = 0;
        BWAPIFrameOffset = 0;
        initialSkipGameFrames = resetTo;
        unitsLastFrame = [];
        unitsThisFrame = [];
        units.clear();
        resetTo = undefined;
      }
      clearInfoDiv();
      appendInfoDiv(`Frame: ${gameFrame}`);
      appendInfoDiv(
        `Mem %: ${(
          window.performance.memory.usedJSHeapSize /
          window.performance.memory.totalJSHeapSize
        ).toFixed(2)}`
      );

      // if (BWAPIFramesDataView) {
      gameloop: for (
        let gf = 0;
        gf < numSkipGameFrames + initialSkipGameFrames;
        gf++
      ) {
        // while (BWAPIFrame + gf < headers.durationFrames) {
        while (true) {
          const { frameData, frameSize } = BWAPIFrameFromBuffer(
            BWAPIFramesDataView,
            BWAPIFrameOffset
          );

          const unit = units.spawnIfNotExists(frameData);
          units.update(unit, frameData);

          BWAPIFrameOffset = BWAPIFrameOffset + frameSize;
          if (gameFrame === frameData.frame) {
            unitsThisFrame.push(frameData.repId);
          } else {
            units.killUnits(difference(unitsLastFrame, unitsThisFrame));
            unitsLastFrame = [...unitsThisFrame];
            unitsThisFrame = [frameData.repId];
            gameFrame = frameData.frame;
            break;
          }
        }
        // units.units.updateMatrixWorld(true);
      }
      units.updateDeadUnits();
    }
    initialSkipGameFrames = 0;

    //#endregion

    pointLight.position.copy(camera.position);
    pointLight.position.y += 5;

    cubeCamera.position.copy(camera.position);
    cubeCamera.rotation.copy(camera.rotation);
    cubeCamera.update(renderer, scene);

    renderer.clear();
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);

    setTimeout(() => {
      requestAnimationFrameId = requestAnimationFrame(gameLoop);
    }, 10);
  }

  gameLoop();

  const dispose = () => {
    console.log("disposing");

    running = false;
    cancelAnimationFrame(requestAnimationFrameId);
    cancelResize();
    disposeMeshes(scene);
    cameraControls.dispose();
    bgMusic.dispose();
    renderer.dispose();

    //@todo dispose
    // cubeCamera.dispose();

    document.removeEventListener("keydown", keyDownListener);
    document.removeEventListener("mousedown", mouseDownListener);

    window.dispose = null;
    window.goto = null;
  };

  window.dispose = dispose;

  window.onbeforeunload = (e) => {
    dispose();
  };
  if (module.hot) {
    module.hot.dispose((data) => {
      Object.assign(data, { camera, BWAPIFrame: BWAPIFrameOffset, filepath });
      dispose();
    });
  }

  return {
    dispose,
  };
}
