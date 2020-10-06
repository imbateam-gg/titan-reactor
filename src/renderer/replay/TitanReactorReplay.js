import * as THREE from "three";
import React from "react";
import { sunlight, fog } from "environment/lights";
import { getTerrainY } from "environment/displacementGeometry";
import { backgroundTerrainMesh } from "environment/meshes/backgroundTerrainMesh";
import { bgMapCanvasTexture } from "environment/textures/bgMapCanvasTexture";
import { Terrain } from "environment/Terrain";

import { initCamera, initCubeCamera } from "../camera-minimap/camera";
import { handleResize } from "utils/resize";

import { BWAPIUnitFromBuffer, BWAPIBulletFromBuffer } from "./BWAPIFrames";
import { BgMusic } from "../audio/BgMusic";

import { Game } from "./Game";
import { disposeMeshes } from "../utils/dispose";
//todo refactor out
import { openFile } from "../invoke";
import { difference, range, compose } from "ramda";
import { ReplayPosition, ClockMs } from "./ReplayPosition";
import { gameSpeeds } from "../utils/conversions";
import HUD from "../react-ui/hud/HUD";
import { unitTypes } from "../../common/bwdat/unitTypes";
import HeatmapScore from "../react-ui/hud/HeatmapScore";

export const hot = module.hot ? module.hot.data : null;

export async function TitanReactorReplay(
  filepath,
  parentUpdateUi,
  { header, commands, chk },
  BWAPIFramesDataView,
  renderImage,
  renderer,
  bwDat,
  textureCache,
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

  const pointLight = new THREE.PointLight(0xffffff, 1, 60, 0);
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

  const game = new Game(
    bwDat,
    renderImage,
    chk.tileset,
    chk.size,
    terrainY,
    audioListener,
    {}
  );
  scene.add(game.units);

  const resize = handleResize(camera, renderer);

  let requestAnimationFrameId = null;

  const heatMapScore = new HeatmapScore(bwDat);
  let replayPosition = new ReplayPosition(
    BWAPIFramesDataView,
    100000000,
    // header.durationFrames,
    new ClockMs(),
    gameSpeeds.slowest,
    heatMapScore
  );

  THREE.DefaultLoadingManager.onLoad = () => {
    loaded();
    replayPosition.resume();
  };

  replayPosition.onResetState = () => {
    unitsLastFrame = [];
    unitsThisFrame = [];
    game.clear();
  };

  const keyDownListener = (e) => {
    if (e.code === "KeyP") {
      if (replayPosition.paused) {
        replayPosition.resume();
      } else {
        replayPosition.pause();
      }
    }

    if (e.code === "KeyG") {
      gridHelper.visible = !gridHelper.visible;
    }
  };

  window.goto = (frame) => replayPosition.goto(frame);

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
    const intersects = raycaster.intersectObjects(game.getUnits(), true);
    const getAsUnit = (mesh) => {
      if (!mesh) return null;
      if (mesh.userData && mesh.userData.typeId !== undefined) {
        return mesh;
      } else {
        return getAsUnit(mesh.parent);
      }
    };

    if (!intersects.length) return;
    intersects.slice(0, 1).forEach(({ object }) => {
      const unit = getAsUnit(object);

      if (unit) {
        console.log(unit.userData.repId, unit);
      }
    });
  };
  document.addEventListener("mousedown", mouseDownListener);

  let unitsLastFrame = [];
  let unitsThisFrame = [];

  const version = replayPosition.readUInt32AndAdvance();
  if (version !== 3) {
    throw new Error("invalid rep.bin version");
  }
  replayPosition.maxFrame = replayPosition.readInt32AndAdvance();

  const hudData = {
    position: () => replayPosition.bwGameFrame / replayPosition.maxFrame,
    onChangeGameSpeed: (speed) => (replayPosition.gameSpeed = speed),
    onChangeAutoGameSpeed: (val) => {
      replayPosition.setAutoSpeed(val);
      updateUi();
    },
    onChangePosition: (pos) => {
      replayPosition.goto(Math.floor(pos * replayPosition.maxFrame));
      updateUi();
    },
    onTogglePlay: (play) => {
      if (play) {
        replayPosition.resume();
      } else {
        replayPosition.pause();
      }
      updateUi();
    },
  };

  resize.refresh();

  let uiUpdated = false;
  const updateUi = () => {
    // just in case we call several times in game loop
    if (uiUpdated) return;
    uiUpdated = true;
    parentUpdateUi(
      <HUD
        autoSpeed={replayPosition.autoSpeed}
        destination={replayPosition.destination}
        gameSpeed={replayPosition.gameSpeed}
        maxFrame={replayPosition.maxFrame}
        position={hudData.position()}
        paused={replayPosition.paused}
        timeLabel={replayPosition.getFriendlyTime()}
        onChangeGameSpeed={hudData.onChangeGameSpeed}
        onChangeAutoGameSpeed={hudData.onChangeAutoGameSpeed}
        onChangePosition={hudData.onChangePosition}
        onTogglePlay={hudData.onTogglePlay}
      />
    );
  };

  function gameLoop() {
    uiUpdated = false;
    if (replayPosition.frame % 24 === 0) {
      updateUi();
    }

    replayPosition.update();
    game.cameraUpdate(camera, cameraControls);

    //#region BWAPIFrames interpretation
    if (!replayPosition.paused) {
      clearInfoDiv();
      appendInfoDiv(`Frame: ${replayPosition.bwGameFrame}`);
      appendInfoDiv(`Time: ${replayPosition.getFriendlyTime()}`);
      appendInfoDiv(
        `Mem : ${window.performance.memory.usedJSHeapSize.toFixed(2)}`
      );

      for (let gf = 0; gf < replayPosition.skipGameFrames; gf++) {
        replayPosition.bwGameFrame = replayPosition.readUInt32AndAdvance();

        if (replayPosition.isMaxFrame()) {
          replayPosition.pause();
          continue;
        }

        const numUnitsThisFrame = replayPosition.readUInt32AndAdvance();

        unitsThisFrame = range(0, numUnitsThisFrame).map(() => {
          const { frameData, frameSize } = BWAPIUnitFromBuffer(
            BWAPIFramesDataView,
            replayPosition.bwapiBufferPosition
          );

          game.updateUnit(
            frameData,
            replayPosition.bwGameFrame,
            replayPosition.skippingFrames()
          );

          replayPosition.advanceBuffer(frameSize);

          return frameData.repId;
        });

        // const numBulletsThisFrame = replayPosition.readUInt32AndAdvance();

        // range(0, numUnitsThisFrame).map(() => {
        //   const { frameData, frameSize } = BWAPIBulletFromBuffer(
        //     BWAPIFramesDataView,
        //     replayPosition.bwapiBufferPosition
        //   );

        //   replayPosition.advanceBuffer(frameSize);

        //   return frameData.repId;
        // });

        game.killUnits(difference(unitsLastFrame, unitsThisFrame));
        unitsLastFrame = [...unitsThisFrame];
        // units.units.updateMatrixWorld(true);
      }

      const attackingUnits = compose(
        (units) => heatMapScore.unitsOfInterest(units),
        (units) =>
          units.map((unitRepId) => {
            return game.units.children.find(
              ({ userData }) => userData.repId === unitRepId
            );
          })
      );

      if (replayPosition.updateAutoSpeed(attackingUnits(unitsThisFrame))) {
        updateUi();
      }
    }

    //#endregion

    pointLight.position.copy(camera.position);
    pointLight.position.y += 5;

    // cubeCamera.position.copy(camera.position);
    // cubeCamera.rotation.copy(camera.rotation);
    // cubeCamera.update(renderer, scene);

    const adj = cameraControls.target.z - camera.position.z;
    const opp = cameraControls.target.x - camera.position.x;
    const a = Math.atan2(opp, adj) / Math.PI;
    game.cameraDirection.previousDirection = game.cameraDirection.direction;
    if (a < 0) {
      game.cameraDirection.direction = Math.floor((a + 2) * 16 + 16);
    } else {
      game.cameraDirection.direction = Math.floor(a * 16 + 16);
    }

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

    replayPosition.pause();
    cancelAnimationFrame(requestAnimationFrameId);
    resize.dispose();
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
      Object.assign(data, { camera, BWAPIFrame: bwapiBufferFrame, filepath });
      dispose();
    });
  }

  return {
    dispose,
  };
}
