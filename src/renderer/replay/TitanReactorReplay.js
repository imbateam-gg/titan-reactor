import * as THREE from "three";
import React from "react";

import { BWAPIUnitFromBuffer, BWAPIBulletFromBuffer } from "./BWAPIFrames";
import { BgMusic } from "../audio/BgMusic";

import { Game } from "./Game";
import { disposeMeshes } from "../utils/dispose";
//todo refactor out
import { difference, range, compose } from "ramda";
import { ReplayPosition, ClockMs } from "./ReplayPosition";
import { gameSpeeds } from "../utils/conversions";
import HUD from "../react-ui/hud/HUD";
import HeatmapScore from "../react-ui/hud/HeatmapScore";
import { DebugInfo } from "../utils/DebugINfo";
import { Cameras } from "./Cameras";
import { TitanReactorScene } from "../3d-map-rendering/TitanReactorScene";
import { Scene } from "three";

export const hot = module.hot ? module.hot.data : null;

export async function TitanReactorReplay(
  context,
  filepath,
  reactApp,
  chk,
  rep,
  BWAPIFramesDataView,
  renderImage,
  bwDat,
  textureCache
) {
  const scene = new Scene();
  const titanReactorScene = new TitanReactorScene(chk, textureCache);

  await titanReactorScene.init(scene);

  const debugInfo = new DebugInfo();

  const cameras = new Cameras(context, titanReactorScene.terrain.material.map);
  if (hot && hot.camera) {
    cameras.main.position.copy(hot.camera.position);
    cameras.main.rotation.copy(hot.camera.rotation);
  }
  cameras.control.update();
  scene.add(cameras.cubeCamera);

  const pointLight = new THREE.PointLight(0xffffff, 1, 60, 0);
  pointLight.power = 20;
  pointLight.castShadow = true;
  scene.add(pointLight);

  const audioListener = new THREE.AudioListener();
  cameras.main.add(audioListener);
  const bgMusic = new BgMusic(audioListener);
  bgMusic.setVolume(0.0);
  bgMusic.playGame();
  scene.add(bgMusic.getAudio());

  const game = new Game(
    bwDat,
    renderImage,
    chk.tileset,
    chk.size,
    titanReactorScene.getTerrainY(),
    audioListener,
    {}
  );
  scene.add(game.units);

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
      titanReactorScene.gridHelper.visible = !titanReactorScene.gridHelper
        .visible;
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
    raycaster.setFromCamera(mouse, cameras.main);

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

  const version = replayPosition.readInt32AndAdvance();
  if (version !== 4) {
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

  const lostContextHandler = () => {
    context.renderer.setAnimationLoop(null);
  };
  context.addEventListener("lostcontext", lostContextHandler);

  const restoreContextHandler = () => {
    context.initRenderer(true);
    cameras.onRestoreContext(scene);
    context.renderer.setAnimationLoop(gameLoop);
  };
  context.addEventListener("lostcontext", restoreContextHandler);

  const sceneResizeHandler = () => {
    cameras.onResize();
  };
  context.addEventListener("resize", sceneResizeHandler);
  context.forceResize();

  const players = [
    {
      name: rep.header.players[0].name,
      minerals: 0,
      gas: 0,
      workers: 4,
      supply: 4,
      race: rep.header.players[0].race,
      apm: 0,
      color: "#f56565",
      units: [],
    },
    {
      name: rep.header.players[1].name,
      minerals: 0,
      gas: 0,
      workers: 4,
      supply: 4,
      race: rep.header.players[1].race,
      apm: 0,
      color: "#4299e1",
      units: [],
    },
  ];

  let uiUpdated = false;
  const updateUi = () => {
    // just in case we call several times in game loop
    if (uiUpdated) return;
    uiUpdated = true;

    players[0].supply = game.supplyTaken[0];
    players[1].supply = game.supplyTaken[1];
    players[0].workers = game.getWorkerCount(0);
    players[1].workers = game.getWorkerCount(1);

    reactApp.render(
      <HUD
        players={players}
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

    //only update rep position every fastest frame update
    if (replayPosition.frame % 24 === 0) {
      updateUi();
    }

    replayPosition.update();

    if (!replayPosition.paused) {
      debugInfo.clear();
      debugInfo.append(`Frame: ${replayPosition.bwGameFrame}`);
      debugInfo.append(`Time: ${replayPosition.getFriendlyTime()}`);
      debugInfo.append(
        `Mem : ${window.performance.memory.usedJSHeapSize.toFixed(2)}`
      );

      for (let gf = 0; gf < replayPosition.skipGameFrames; gf++) {
        replayPosition.bwGameFrame = replayPosition.readInt32AndAdvance();

        players[0].gas = replayPosition.readInt32AndAdvance();
        players[1].gas = replayPosition.readInt32AndAdvance();
        players[0].minerals = replayPosition.readInt32AndAdvance();
        players[1].minerals = replayPosition.readInt32AndAdvance();

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

    pointLight.position.copy(cameras.main.position);
    pointLight.position.y += 5;

    // cameras.updateCubeCamera(scene);

    game.cameraDirection.previousDirection = game.cameraDirection.direction;

    game.cameraDirection.direction = cameras.getDirection32();

    game.setShear(cameras.getShear());

    context.renderer.clear();
    context.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    context.renderer.render(scene, cameras.main);
  }

  context.renderer.setAnimationLoop(gameLoop);

  const dispose = () => {
    console.log("disposing");

    replayPosition.pause();
    disposeMeshes(scene);

    bgMusic.dispose();

    context.renderer.setAnimationLoop(null);
    context.removeEventListener("resize", sceneResizeHandler);
    context.removeEventListener("lostcontext", lostContextHandler);
    context.removeEventListener("lostcontext", restoreContextHandler);

    cameras.dispose();
    debugInfo.dispose();

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
      Object.assign(data, {
        camera: cameras.main,
        BWAPIFrame: replayPosition.bwGameFrame,
        filepath,
      });
      dispose();
    });
  }

  return {
    dispose,
  };
}
