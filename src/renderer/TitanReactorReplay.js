import React from "react";
import { PointLight, Raycaster, Vector2, AudioListener, Color } from "three";

import {
  BWAPIUnitFromBuffer,
  BWAPIBulletFromBuffer,
} from "./replay/BWAPIFrames";
import { BgMusic } from "./audio/BgMusic";

import { Game } from "./replay/Game";
//todo refactor out
import { difference, range } from "ramda";
import { ReplayPosition, ClockMs } from "./replay/ReplayPosition";
import { gameSpeeds, pxToMapMeter } from "./utils/conversions";
import HUD from "./react-ui/hud/HUD";
import HeatmapScore from "./react-ui/hud/HeatmapScore";
import { DebugInfo } from "./utils/DebugINfo";
import { Cameras } from "./replay/Cameras";
import { Minimap } from "./replay/Minimap";
import { Players } from "./replay/Players";
import { FadingPointers } from "./mesh/FadingPointers";
import { MinimapUnitLayer } from "./replay/Layers";
import { commands } from "bwdat/commands";
export const hot = module.hot ? module.hot.data : null;

export async function TitanReactorReplay(
  context,
  filepath,
  reactApp,
  scene,
  chk,
  rep,
  BWAPIFramesDataView,
  renderImage,
  bwDat
) {
  const debugInfo = new DebugInfo();

  console.log("rep", rep);

  const pxToMeter = pxToMapMeter(chk.size[0], chk.size[1]);
  const heatMapScore = new HeatmapScore(bwDat);
  const minimap = new Minimap(
    context.getMinimapCanvas(),
    scene.terrain.material.map,
    chk.size[0],
    chk.size[1],
    heatMapScore
  );

  const cameras = new Cameras(context, scene.terrain.material.map, minimap);
  if (hot && hot.camera) {
    cameras.main.position.copy(hot.camera.position);
    cameras.main.rotation.copy(hot.camera.rotation);
  }
  cameras.control.update();
  scene.add(cameras.cubeCamera);

  scene.add(minimap.minimapPlane);
  scene.add(minimap.heatmap);
  scene.add(cameras.minimapCameraHelper);

  const pointLight = new PointLight(0xffffff, 1, 60, 0);
  pointLight.power = 20;
  pointLight.castShadow = true;
  scene.add(pointLight);

  const audioListener = new AudioListener();
  cameras.main.add(audioListener);
  const bgMusic = new BgMusic(audioListener);
  bgMusic.setVolume(0.01);
  bgMusic.playGame();
  scene.add(bgMusic.getAudio());

  const players = new Players(rep.header.players);

  const getTerrainY = scene.getTerrainY();
  const game = new Game(
    bwDat,
    renderImage,
    chk.tileset,
    chk.size,
    getTerrainY,
    audioListener,
    players,
    {}
  );
  scene.add(game.units);

  let replayPosition = new ReplayPosition(
    BWAPIFramesDataView,
    rep.header.frameCount,
    new ClockMs(),
    gameSpeeds.slowest,
    heatMapScore
  );

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

    // esc
    if (e.keyCode == 27) {
      console.log("options");
    }

    if (e.code === "KeyG") {
      scene.gridHelper.visible = !scene.gridHelper.visible;
    }
  };

  window.goto = (frame) => replayPosition.goto(frame);

  document.addEventListener("keydown", keyDownListener);

  const mouseDownListener = (event) => {
    var raycaster = new Raycaster();
    var mouse = new Vector2();

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

  const fadingPointers = new FadingPointers();
  fadingPointers.layers.enable(MinimapUnitLayer);
  scene.add(fadingPointers);

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
    onTogglePaused: (pause) => {
      if (pause) {
        replayPosition.pause();
      } else {
        replayPosition.resume();
      }
      updateUi();
    },
    onShowHeatMap: () => {
      minimap.toggleHeatmap();
      if (minimap.heatmapEnabled) {
        minimap.heatmap.reset();
      }
    },
    onTogglePlayerActions: (player) => {
      players[player].showActions = !players[player].showActions;
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
    minimap.refresh();
  };
  context.addEventListener("resize", sceneResizeHandler);
  context.forceResize();

  let uiUpdated = false;
  let firstUiUpdate = true;
  const updateUi = () => {
    // just in case we call several times in game loop
    if (uiUpdated) return;

    uiUpdated = true;

    players.updateResources(game);

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
        onTogglePaused={hudData.onTogglePaused}
        minimapCanvas={context.minimapCanvas}
        onShowHeatMap={hudData.onShowHeatMap}
        heatmapEnabled={minimap.heatmapEnabled}
        onTogglePlayerActions={hudData.onTogglePlayerActions}
      />
    );
    if (firstUiUpdate) {
      minimap.refresh();
      firstUiUpdate = false;
    }
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

        unitsThisFrame = [];
        for (let i = 0; i < numUnitsThisFrame; i++) {
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

          unitsThisFrame.push(frameData.repId);
        }

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

        if (rep.cmds[replayPosition.bwGameFrame]) {
          for (let cmd of rep.cmds[replayPosition.bwGameFrame]) {
            if (!players[cmd.player].showActions) continue;
            switch (cmd.id) {
              case commands.rightClick:
              case commands.targetedOrder:
              case commands.build:
                const px = pxToMeter.x(cmd.x);
                const py = pxToMeter.y(cmd.y);
                const pz = getTerrainY(px, py);

                fadingPointers.addPointer(
                  px,
                  py,
                  pz,
                  players[cmd.player].color.rgb,
                  replayPosition.bwGameFrame
                );
            }
          }
        }
        fadingPointers.update(replayPosition.bwGameFrame);
      }

      if (replayPosition.autoSpeed || minimap.heatmapEnabled) {
        const attackingUnits = unitsThisFrame
          .map((unitRepId) =>
            game.units.children.find(
              ({ userData }) => userData.repId === unitRepId
            )
          )
          .filter((unit) => heatMapScore.unitOfInterestFilter(unit));

        if (replayPosition.updateAutoSpeed(attackingUnits)) {
          updateUi();
        }
        if (minimap.heatmapEnabled) {
          minimap.heatmap.update(replayPosition.bwGameFrame, attackingUnits);
        }
      }
    }

    pointLight.position.copy(cameras.main.position);
    pointLight.position.y += 5;

    // cameras.updateCubeCamera(scene);

    game.cameraDirection.previousDirection = game.cameraDirection.direction;

    game.cameraDirection.direction = cameras.getDirection32();
    game.setShear(cameras.getShear());

    context.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    context.renderer.render(scene, cameras.main);

    context.renderer.clearDepth();
    context.renderer.setScissor(minimap.viewport);
    context.renderer.setScissorTest(true);
    context.renderer.setViewport(minimap.viewport);
    context.renderer.render(scene, minimap.camera); //minimap.camera);
    context.renderer.setScissorTest(false);
  }

  context.renderer.setAnimationLoop(gameLoop);

  //@todo add settings to not auto play
  replayPosition.resume();

  const dispose = () => {
    console.log("disposing");

    context.renderer.setAnimationLoop(null);

    replayPosition.pause();

    bgMusic.dispose();

    context.removeEventListener("resize", sceneResizeHandler);
    context.removeEventListener("lostcontext", lostContextHandler);
    context.removeEventListener("lostcontext", restoreContextHandler);

    minimap.dispose();
    scene.dispose();
    cameras.dispose();
    debugInfo.dispose();

    document.removeEventListener("keydown", keyDownListener);
    document.removeEventListener("mousedown", mouseDownListener);

    window.goto = null;
  };

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
