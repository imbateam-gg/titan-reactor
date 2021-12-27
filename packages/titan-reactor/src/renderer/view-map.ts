// playground for environment
import { debounce } from "lodash";
import { Color, MOUSE, Object3D } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { strict as assert } from "assert";
import type { ChkUnit, ChkSprite } from "bw-chk";

import { iscriptHeaders, unitTypes } from "../common/bwdat/enums";
import { CanvasTarget } from "../common/image";
import { createImageFactory, IScriptSprite } from "./core"
import type {
  TerrainInfo,
} from "../common/types";
import { pxToMapMeter } from "../common/utils/conversions";
import CameraRig from "./camera/camera-rig";
import FogOfWar from "./fogofwar/fog-of-war";
import { InputEvents, KeyboardShortcuts } from "./input";
import { Renderer, Scene } from "./render";
import { getAssets, useHudStore, useSettingsStore } from "./stores";
import Janitor from "./utils/janitor";
import createStartLocation from "./core/create-start-location"
import Chk from "bw-chk";


async function TitanReactorMap(
  chk: Chk,
  terrainInfo: TerrainInfo,
  scene: Scene
) {
  const janitor = new Janitor();
  const assets = getAssets();
  assert(assets);

  const preplacedMapUnits = chk.units;
  const preplacedMapSprites = chk.sprites;

  // createIScriptRunnerFactory(assets.bwDat, chk.tileset)

  const createIScriptSprite = () => {
    return new IScriptSprite(
      null,
      assets.bwDat,
      createIScriptSprite,
      createImageFactory(
        assets.bwDat,
        assets.grps,
        settings.spriteTextureResolution,
      ),
      (sprite: Object3D) => scene.add(sprite)
    );
  };

  const { mapWidth, mapHeight } = terrainInfo;
  const pxToGameUnit = pxToMapMeter(mapWidth, mapHeight);

  let settings = useSettingsStore.getState().data;
  if (!settings) {
    throw new Error("Settings not loaded");
  }

  const keyboardShortcuts = new KeyboardShortcuts(document.body);
  janitor.disposable(keyboardShortcuts)

  const toggleMenuHandler = () => useHudStore.getState().toggleInGameMenu();
  keyboardShortcuts.addEventListener(InputEvents.ToggleMenu, toggleMenuHandler);

  const toggleCursorHandler = () => {
    if (window.document.body.style.cursor === "none") {
      window.document.body.style.cursor = "";
    } else {
      window.document.body.style.cursor = "none";
    }
  };
  keyboardShortcuts.addEventListener(
    InputEvents.ToggleCursor,
    toggleCursorHandler
  );
  janitor.callback(() => window.document.body.style.cursor = "");

  const gameSurface = new CanvasTarget();
  gameSurface.setDimensions(window.innerWidth, window.innerHeight);
  document.body.appendChild(gameSurface.canvas);

  scene.background = new Color(settings.mapBackgroundColor);

  const cameraRig = new CameraRig({
    settings,
    gameSurface,
    keyboardShortcuts,
    freeControl: true,
  }
  );
  janitor.disposable(cameraRig);

  //@ts-ignore
  window.cameraRig = cameraRig;
  // @ts-ignore
  janitor.callback(() => cameraRig = null)
  const orbitControls = new OrbitControls(cameraRig.camera, gameSurface.canvas);
  janitor.disposable(orbitControls);

  orbitControls.screenSpacePanning = false;
  orbitControls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.ROTATE,
  };
  cameraRig.camera.position.set(0, 120, 100);
  cameraRig.camera.lookAt(0, 0, 0);

  const renderer = new Renderer(settings);
  janitor.disposable(renderer);

  await renderer.init(cameraRig.camera);
  if (!renderer.renderer) {
    throw new Error("Renderer not initialized");
  }
  renderer.enableRenderPass();
  //@ts-ignore
  window.renderMan = renderer;
  // @ts-ignore
  janitor.callback(() => renderMan = null)

  const fogOfWar = new FogOfWar(mapWidth, mapHeight, renderer.fogOfWarEffect);
  janitor.disposable(fogOfWar);

  fogOfWar.enabled = false;

  const playerColors = [
    "#a80808",
    "#083498",
    "#209070",
    "#88409c",
    "#e87824",
    "#34200c",
    "#c4c0bc",
    "dcdc3c",
  ];
  const startLocations = preplacedMapUnits
    .filter((unit) => unit.unitId === 214)
    .map((unit) => {
      const x = unit.x / 32 - mapWidth / 2;
      const y = unit.y / 32 - mapHeight / 2;
      return createStartLocation(
        x,
        y,
        playerColors[unit.player],
        terrainInfo.getTerrainY(x, y)
      );
    });
  startLocations.forEach((sl) => scene.add(sl));

  const sprites: IScriptSprite[] = [];
  const critters: IScriptSprite[] = [];
  const disabledDoodads: IScriptSprite[] = [];

  for (const unit of preplacedMapUnits) {
    continue;
  }

  for (const sprite of preplacedMapSprites) {
    continue;

  }

  const _sceneResizeHandler = () => {
    gameSurface.setDimensions(window.innerWidth, window.innerHeight);
    renderer.setSize(gameSurface.scaledWidth, gameSurface.scaledHeight);

    cameraRig.updateGameScreenAspect(gameSurface.width, gameSurface.height);
  };
  const sceneResizeHandler = debounce(_sceneResizeHandler, 500);
  window.addEventListener("resize", sceneResizeHandler, false);
  janitor.callback(() => window.removeEventListener("resize", sceneResizeHandler));


  let last = 0;
  let frame = 0;
  let frameElapsed = 0;
  renderer.setCanvasTarget(gameSurface);
  renderer.setSize(gameSurface.scaledWidth, gameSurface.scaledHeight);

  function gameLoop(elapsed: number) {
    const delta = elapsed - last;
    frameElapsed += delta;
    if (frameElapsed > 42) {
      frame++;
      if (frame % 8 === 0) {
        scene.incrementTileAnimation();
      }
      for (const sprite of sprites) {
        sprite.update(delta);
      }
      frameElapsed = 0;
    }

    cameraRig.update();
    renderer.updateFocus(cameraRig.camera);
    fogOfWar.update(cameraRig.camera);
    renderer.render(scene, cameraRig.camera, delta);
    last = elapsed;

    orbitControls.update();
  }

  renderer.renderer.setAnimationLoop(gameLoop);

  //@ts-ignore
  window.scene = scene;
  // @ts-ignore
  janitor.callback(() => scene = null)

  const unsub = useSettingsStore.subscribe((state, prevState) => {
    settings = state.data;
    const prevSettings = prevState.data;
    if (settings === null || prevSettings === null) return;

    if (prevSettings.showDisabledDoodads !== settings.showDisabledDoodads) {
      for (const doodad of disabledDoodads) {
        doodad.visible = settings.showDisabledDoodads;
      }
    }

    if (prevSettings.showCritters !== settings.showCritters) {
      for (const critter of critters) {
        critter.visible = settings.showCritters;
      }
    }

    if (prevSettings.mapBackgroundColor !== settings.mapBackgroundColor) {
      scene.background = new Color(settings.mapBackgroundColor);
    }
  });
  janitor.callback(unsub)

  const dispose = () => {

    janitor.mopUp();

  };

  return {
    isMap: true,
    scene,
    gameSurface,
    dispose,
  };
}

export default TitanReactorMap;
