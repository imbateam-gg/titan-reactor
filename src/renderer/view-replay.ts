import { debounce } from "lodash";
import { strict as assert } from "assert";
import { Box3, Color, Group, MathUtils, PerspectiveCamera, Vector2, Vector3, Vector4, Scene as ThreeScene, Raycaster } from "three";
import * as THREE from "three";
import { SelectionBox } from 'three/examples/jsm/interactive/SelectionBox';

import { easeCubicIn } from "d3-ease";
import CameraControls from "camera-controls";
import type Chk from "bw-chk";
import { ClearPass, RenderPass, EffectPass } from "postprocessing";

import { BulletState, DamageType, drawFunctions, Explosion, orders, UnitFlags, unitTypes } from "common/enums";
import { CanvasTarget } from "./image";
import {
  UnitDAT, WeaponDAT, TerrainInfo
} from "common/types";
import { gameSpeeds, pxToMapMeter, tile32 } from "common/utils/conversions";
import { SoundStruct, SpriteStruct, ImageStruct } from "common/types/structs";
import type { MainMixer, Music, SoundChannels } from "./audio";

import ProjectedCameraView from "./camera/projected-camera-view";
import {
  GameStatePosition,
  Image,
  Players,
  Unit,
  GameStatePlayMode,
  ImageHD,
} from "./core";
import Creep from "./creep/creep";
import FogOfWar from "./fogofwar/fog-of-war";
import {
  MinimapMouse,
  PluginKeyShortcuts,
  MouseSelectionBox,
  MouseCursor
} from "./input";
import { FrameBW, ImageBufferView, SpritesBufferView } from "./buffer-view";
import * as log from "./ipc/log";
import {
  GameCanvasTarget
} from "./render";
import renderer from "./render/renderer";
import {
  useSettingsStore, useWorldStore,
} from "./stores";
import { imageHasDirectionalFrames, imageIsFlipped, imageIsFrozen, imageIsHidden, imageNeedsRedraw } from "./utils/image-utils";
import { getBwPanning, getBwVolume, MinPlayVolume as SoundPlayMinVolume } from "./utils/sound-utils";
import { openBw } from "./openbw";
import { spriteIsHidden, spriteSortOrder } from "./utils/sprite-utils";
import { getDirection32, setBoundary } from "./utils/camera-utils";
import { CameraKeys } from "./input/camera-keys";
import { IntrusiveList } from "./buffer-view/intrusive-list";
import UnitsBufferView from "./buffer-view/units-buffer-view";
import { CameraMouse } from "./input/camera-mouse";
import CameraShake from "./camera/camera-shake";
import Janitor from "./utils/janitor";
import { CameraModePlugin, PIP } from "./input/camera-mode";
import BulletsBufferView from "./buffer-view/bullets-buffer-view";
import { WeaponBehavior } from "../common/enums";
import gameStore from "./stores/game-store";
import * as plugins from "./plugins";
import settingsStore from "./stores/settings-store";
import { Scene } from "./render/scene";
import type OpenBwWasmReader from "./openbw/openbw-reader";
import type Assets from "./assets/assets";
import { Replay } from "./process-replay/parse-replay";
import CommandsStream from "./process-replay/commands/commands-stream";
import { HOOK_ON_FRAME_RESET, HOOK_ON_GAME_READY, HOOK_ON_UNITS_CLEAR_FOLLOWED, HOOK_ON_UNITS_FOLLOWED, HOOK_ON_UNIT_CREATED, HOOK_ON_UNIT_KILLED, HOOK_ON_UNIT_UNFOLLOWED } from "./plugins/hooks";
import { canSelectUnit, unitIsFlying } from "@utils/unit-utils";
import withErrorMessage from "common/utils/with-error-message";
import FogOfWarEffect from "./fogofwar/fog-of-war-effect";
import { CSS2DRenderer } from "./render/css-renderer";
import { ipcRenderer } from "electron";
import { RELOAD_PLUGINS } from "common/ipc-handle-names";
import FPSMeter from "@utils/fps-meter";
import SelectionCircle from "@core/selection-circle";
import selectedUnitsStore from "@stores/selected-units-store";

CameraControls.install({ THREE: THREE });

const { startLocation } = unitTypes;
const _cameraTarget = new Vector3();
const _cameraPosition = new Vector3();

async function TitanReactorGame(
  map: Chk,
  terrain: TerrainInfo,
  scene: Scene,
  assets: Assets,
  janitor: Janitor,
  replay: Replay,
  audioMixer: MainMixer,
  soundChannels: SoundChannels,
  music: Music,
  gameStateReader: OpenBwWasmReader,
  commandsStream: CommandsStream
) {
  let settings = settingsStore().data;
  commandsStream;

  const preplacedMapUnits = map.units;
  const bwDat = assets.bwDat;
  assert(openBw.wasm);

  openBw.call!.setGameSpeed!(1);
  openBw.call!.setPaused!(false);

  const fps = new FPSMeter();

  const createImage = (imageTypeId: number) => {
    const atlas = assets.grps[imageTypeId];
    if (!atlas) {
      throw new Error(`imageId ${imageTypeId} not found`);
    }

    const imageDef = bwDat.images[imageTypeId];

    if (freeImages.length > 0) {
      const freeImage = freeImages.pop() as Image;
      freeImage.changeImage(atlas, imageDef);
      return freeImage;
    }

    return new ImageHD(
      atlas,
      imageDef
    );
  }

  const { mapWidth, mapHeight } = terrain;

  const cssScene = new ThreeScene();
  const cssRenderer = new CSS2DRenderer();
  cssRenderer.domElement.style.position = 'absolute';
  cssRenderer.domElement.style.pointerEvents = 'none';
  cssRenderer.domElement.style.top = '0px';
  cssRenderer.domElement.style.zIndex = '100';
  document.body.appendChild(cssRenderer.domElement);
  janitor.callback(() => document.body.removeChild(cssRenderer.domElement));

  const gameSurface = new GameCanvasTarget(settings, mapWidth, mapHeight);
  gameSurface.setDimensions(window.innerWidth, window.innerHeight);

  document.body.appendChild(gameSurface.canvas);
  janitor.callback(() => document.body.removeChild(gameSurface.canvas));
  gameStore().setDimensions(gameSurface.getRect());

  const minimapSurface = new CanvasTarget();
  minimapSurface.canvas.style.position = "absolute";
  minimapSurface.canvas.style.bottom = "0";
  minimapSurface.canvas.style.zIndex = "20";
  document.body.appendChild(minimapSurface.canvas);
  janitor.callback(() => document.body.removeChild(minimapSurface.canvas));

  const pxToGameUnit = pxToMapMeter(mapWidth, mapHeight);

  const camera = new PerspectiveCamera(15, gameSurface.width / gameSurface.height, 0.1, 500);
  camera.userData = {
    direction: 0,
    prevDirection: -1
  };

  const minimapMouse = new MinimapMouse(
    minimapSurface,
    mapWidth,
    mapHeight
  );
  janitor.disposable(minimapMouse);
  minimapMouse.addEventListener("mousedown", () => {
    clearFollowedUnits();
  })



  const _PIP: PIP = {
    enabled: false,
    camera: new PerspectiveCamera(15, 1, 0.1, 1000),
    viewport: new Vector4(0, 0, 300, 200),
    margin: 20,
    height: 300,
    update() {
      const aspect = camera.aspect;

      const pipWidth = this.height * aspect;
      if (this.position) {
        const x = this.position.x - pipWidth / 2;
        const y = window.innerHeight - this.position.y - (this.height / 2);
        _PIP.viewport.set(MathUtils.clamp(x, 0, gameSurface.scaledWidth - pipWidth), MathUtils.clamp(y, 0, window.innerHeight - this.height), pipWidth, this.height);
      } else {
        _PIP.viewport.set(gameSurface.scaledWidth - pipWidth - this.margin, this.margin, pipWidth, this.height);
      }

      _PIP.camera.aspect = aspect;
      _PIP.camera.updateProjectionMatrix();
    }
  }

  let followedUnits: Unit[] = [];

  let followedTarget = new Vector3();
  const setFollowedUnits = (units: Unit[]) => {
    followedUnits = [...units];
    plugins.callHook(HOOK_ON_UNITS_FOLLOWED, units);
  }

  const unFollowUnit = (unit: Unit) => {
    const idx = followedUnits.indexOf(unit);
    if (idx > -1) {
      followedUnits.splice(idx, 1);
      plugins.callHook(HOOK_ON_UNIT_UNFOLLOWED, unit);
    }
  }

  const clearFollowedUnits = () => {
    if (followedUnits.length > 0) {
      followedUnits.length = 0;
      plugins.callHook(HOOK_ON_UNITS_CLEAR_FOLLOWED);
    }
  }
  const calculateFollowedUnitsTarget = () => {
    if (followedUnits.length === 0) {
      return;
    }

    followedTarget.set(pxToGameUnit.x(followedUnits[0].x), 0, pxToGameUnit.y(followedUnits[0].y));

    for (let i = 1; i < followedUnits.length; i++) {
      followedTarget.set(
        (followedTarget.x + pxToGameUnit.x(followedUnits[i].x)) / 2,
        0,
        (followedTarget.z + pxToGameUnit.y(followedUnits[i].y)) / 2
      )
    }
    return followedTarget;
  }

  const cameraMouse = new CameraMouse(document.body);
  janitor.disposable(cameraMouse);

  const cameraKeys = new CameraKeys(document.body, () => {
    if (followedUnits.length) {
      clearFollowedUnits();
    } else if (selectedUnitsStore().selectedUnits.length) {
      setFollowedUnits(selectedUnitsStore().selectedUnits);
    }
  });
  janitor.disposable(cameraKeys);

  const createControls = (cameraMode: CameraModePlugin) => {

    const controls = new CameraControls(
      camera,
      gameSurface.canvas,
    );

    const cameraShake = new CameraShake();

    _PIP.camera.position.set(0, 50, 0);
    _PIP.camera.lookAt(0, 0, 0);
    _PIP.enabled = false;
    delete _PIP.position;
    _PIP.height = 300;
    _PIP.update();

    return {
      rested: true,
      cameraMode,
      orbit: controls,
      cameraShake,
      PIP: _PIP
    };
  }


  const units: Map<number, Unit> = new Map();
  const images: Map<number, Image> = new Map();
  const freeImages: Image[] = [];
  const unitsBySprite: Map<number, Unit> = new Map();
  const sprites: Map<number, Group> = new Map();
  const spritesGroup = new Group();
  spritesGroup.name = "sprites";
  scene.add(spritesGroup);

  janitor.callback(() => {
    const _janitor = new Janitor();
    for (const image of freeImages) {
      _janitor.object3d(image);
    }
    _janitor.mopUp();
  });


  const setUseScale = (scale: number) => {
    ImageHD.useScale = scale;
    for (const [, image] of images) {
      if (image instanceof ImageHD) {

        image.scale.copy(image.originalScale);

        if (scale !== 1) {
          image.scale.multiplyScalar(ImageHD.useScale);
        }

        image.updateMatrix();
      }
    }
  }

  const fogOfWar = new FogOfWar(mapWidth, mapHeight, openBw);
  const shortcuts = new PluginKeyShortcuts(window.document.body)

  janitor.disposable(shortcuts);

  const switchCameraMode = async (cameraMode: CameraModePlugin, prevCameraMode?: CameraModePlugin) => {

    let prevData: any;

    if (prevCameraMode) {
      if (prevCameraMode.onExitCameraMode) {
        try {
          const target = new Vector3();
          const position = new Vector3();

          prevCameraMode.orbit!.getTarget(target);
          prevCameraMode.orbit!.getPosition(position);

          prevData = prevCameraMode.onExitCameraMode(target, position);
        } catch (e) {
          log.error(withErrorMessage("onExitCameraMode", e));
        }
      }
      try {
        prevCameraMode.dispose();
      } catch (e) {
        log.error(withErrorMessage("prevCameraMode.dispose", e));
      }
    }

    const newControls = createControls(cameraMode);

    cameraMode.dispose = () => {
      cameraMode.isActiveCameraMode = false;
      cameraMode.orbit?.dispose();
      delete cameraMode.orbit;
    }
    cameraMode.orbit = newControls.orbit;
    newControls.orbit.mouseButtons.left = CameraControls.ACTION.NONE;
    newControls.orbit.mouseButtons.shiftLeft = CameraControls.ACTION.NONE;
    newControls.orbit.mouseButtons.middle = CameraControls.ACTION.NONE;
    newControls.orbit.mouseButtons.wheel = CameraControls.ACTION.NONE;
    newControls.orbit.mouseButtons.right = CameraControls.ACTION.NONE;

    cameraMode.isActiveCameraMode = true;
    await cameraMode.onEnterCameraMode(prevData);

    setUseScale(cameraMode.unitScale || 1);

    if (cameraMode.pointerLock) {
      gameSurface.requestPointerLock();
    } else {
      gameSurface.exitPointerLock();
    }

    if (cameraMode.minimap) {
      minimapSurface.canvas.style.display = "block";
      minimapSurface.canvas.style.pointerEvents = "auto";
      minimapMouse.enabled = true;
    } else {
      minimapMouse.enabled = false;
      minimapSurface.canvas.style.display = "none";
    }

    const rect = gameSurface.getRect();
    gameStore().setDimensions({
      minimapWidth: rect.minimapWidth,
      minimapHeight: minimapSurface.canvas.style.display === "block" ? rect.minimapHeight : 0,
    });

    if (cameraMode.cameraShake) {
      newControls.cameraShake.enabled = true;
    } else {
      newControls.cameraShake.enabled = false;
    }

    if (cameraMode.boundByMap) {
      setBoundary(newControls.orbit, mapWidth, mapHeight);
      newControls.rested = false;
      newControls.orbit.addEventListener('rest', () => {
        newControls.rested = true;
      })
    }

    if (!cameraMode.unitSelection) {
      selectedUnitsStore().clearSelectedUnits();
    }

    scene.disableSkybox();
    scene.disableTiles();
    if (cameraMode.background === "space") {
      scene.enableSkybox();
    } else if (cameraMode.background === "tiles") {
      scene.enableTiles();
    }

    const clearPass = new ClearPass(camera);
    const renderPass = new RenderPass(scene, camera);

    const fogOfWarEffect = new FogOfWarEffect();
    fogOfWar.setEffect(fogOfWarEffect);
    fogOfWarEffect.blendMode.opacity.value = cameraMode.fogOfWar ?? 1;

    if (cameraMode.onSetComposerPasses) {
      renderer.setCameraModeEffectsAndPasses(cameraMode.onSetComposerPasses(clearPass, renderPass, fogOfWarEffect));
    } else {
      renderer.setCameraModeEffectsAndPasses({
        passes: [clearPass, renderPass, new EffectPass(camera, fogOfWarEffect)]
      });
    }
    renderer.changeCamera(camera);

    return newControls;
  }

  let controls = await switchCameraMode(plugins.getDefaultCameraModePlugin());

  // const setUseDepth = (useDepth: boolean) => {
  //   ImageHD.useDepth = useDepth;
  //   for (const [, image] of images) {
  //     if (image instanceof ImageHD) {
  //       image.material.depthTest = ImageHD.useDepth;
  //       image.setFrame(image.frame, image.flip, true);
  //     }
  //   }
  // }

  const projectedCameraView = new ProjectedCameraView(
    camera
  );

  const _stopFollowingOnClick = () => {
    if (settings.game.stopFollowingOnClick) {
      clearFollowedUnits();
    }
  }
  gameSurface.canvas.addEventListener('pointerdown', _stopFollowingOnClick);
  janitor.callback(() => gameSurface.canvas.removeEventListener('pointerdown', _stopFollowingOnClick));

  {
    const selectionBox = new SelectionBox(camera, scene);

    const visualBox = new MouseSelectionBox();
    visualBox.color = "#007f00";
    janitor.disposable(visualBox);

    const mouseCursor = new MouseCursor();
    janitor.disposable(mouseCursor);

    let mouseIsDown = false;
    const _canOnlySelectOne = [
      unitTypes.larva,
      unitTypes.zergEgg,
      unitTypes.geyser,
      unitTypes.mineral1,
      unitTypes.mineral2,
      unitTypes.mineral3,
      unitTypes.mutaliskCocoon,
      unitTypes.lurkerEgg,
    ];

    const canOnlySelectOne = (unit: Unit) => _canOnlySelectOne.includes(unit.typeId)

    const typeIdSort = (a: Unit, b: Unit) => {
      return a.typeId - b.typeId;
    }

    const _selectDown = (event: PointerEvent) => {
      if (!controls.cameraMode.unitSelection || event.button !== 0) return;
      minimapSurface.canvas.style.pointerEvents = "none";
      mouseIsDown = true;
      selectionBox.startPoint.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        - (event.clientY / window.innerHeight) * 2 + 1,
        0.5);

      visualBox.start(event.clientX, event.clientY);

    };
    gameSurface.canvas.addEventListener('pointerdown', _selectDown);
    janitor.callback(() => gameSurface.canvas.removeEventListener('pointerdown', _selectDown));

    const _selectMove = (event: PointerEvent) => {

      if (mouseIsDown) {

        selectionBox.endPoint.set(
          (event.clientX / window.innerWidth) * 2 - 1,
          - (event.clientY / window.innerHeight) * 2 + 1,
          0.5);

        visualBox.end(event.clientX, event.clientY);

      }

    }

    gameSurface.canvas.addEventListener('pointermove', _selectMove);
    janitor.callback(() => gameSurface.canvas.removeEventListener('pointermove', _selectMove));

    const _hasAnyUnit = (unit: Unit) => !unit.extras.dat.isBuilding;

    const _selectRayCaster = new Raycaster();

    const getUnitFromMouseIntersect = (clipV: Vector2) => {
      _selectRayCaster.setFromCamera(clipV, camera);
      const intersects = _selectRayCaster.intersectObjects(spritesGroup.children, true);
      if (intersects.length) {
        let closestUnit: Unit | undefined;
        let closestRenderOrder = -1;

        for (const intersect of intersects) {
          if (
            intersect.uv !== undefined &&
            intersect.object instanceof ImageHD &&
            intersect.object.userData.unit && canSelectUnit(intersect.object.userData.unit)
          ) {
            if (
              intersect.object.renderOrder > closestRenderOrder
            ) {
              closestRenderOrder = intersect.object.renderOrder;
              closestUnit = intersect.object.userData.unit;
            }
          }
        }

        return closestUnit;
      }
    };

    const _selectUp = (event: PointerEvent) => {
      if (!mouseIsDown) return;

      minimapSurface.canvas.style.pointerEvents = "auto";
      mouseIsDown = false;
      visualBox.clear();

      let selectedUnits: Unit[] = [];

      if (!visualBox.isMinDragSize(event.clientX, event.clientY)) {
        const unit = getUnitFromMouseIntersect(new Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1));
        if (unit) {
          selectedUnits.push(unit);
        } else {
          selectedUnitsStore().clearSelectedUnits();
          return;
        }
      } else {

        selectionBox.endPoint.set(
          (event.clientX / window.innerWidth) * 2 - 1,
          - (event.clientY / window.innerHeight) * 2 + 1,
          0.5);


        const allSelected = selectionBox.select();

        for (let i = 0; i < allSelected.length; i++) {
          if (allSelected[i].userData.unit && canSelectUnit(allSelected[i].userData.unit) && !selectedUnits.includes(allSelected[i].userData.unit)) {
            selectedUnits.push(allSelected[i].userData.unit);
          }
        }

        if (event.shiftKey) {
          for (const unit of selectedUnitsStore().selectedUnits) {
            if (!selectedUnits.includes(unit)) {
              selectedUnits.push(unit);
            }
          }
        }
        
        const onlyUnits = selectedUnits.filter(_hasAnyUnit);
        if (onlyUnits.length > 0 && onlyUnits.length !== selectedUnits.length) {
          selectedUnits = onlyUnits;
        }

        // since egg has no cmd icon, dont allow multi select unless they are all the same in which case just select one
        if (
          selectedUnits.length > 1 &&
          selectedUnits.some(canOnlySelectOne)
        ) {
          if (
            selectedUnits.every((unit) => unit.typeId === selectedUnits[0].typeId)
          ) {
            selectedUnits = selectedUnits.slice(-1);
          } else {
            selectedUnits = selectedUnits.filter(
              (unit) => !_canOnlySelectOne.includes(unit.typeId)
            );
          }
        }
      }

      selectedUnits.sort(typeIdSort).splice(12);
      selectedUnitsStore().setSelectedUnits(selectedUnits);

    }
    gameSurface.canvas.addEventListener('pointerup', _selectUp);
    janitor.callback(() => gameSurface.canvas.removeEventListener('pointerup', _selectUp));

  }

  const makeThreeColors = (replay: Replay) => {
    return replay.header.players.map(
      ({ color }) =>
        new Color().setStyle(color).convertSRGBToLinear()
    );
  }

  janitor.callback(useWorldStore.subscribe(world => {
    if (world.replay) {
      const colors = makeThreeColors(world.replay);
      for (let i = 0; i < players.length; i++) {
        players[i].color = colors[i];
      }
    }
  }));

  const players = new Players(
    replay.header.players,
    preplacedMapUnits.filter((u) => u.unitId === startLocation),
    makeThreeColors(replay)
  );

  music.playGame();

  const gameStatePosition = new GameStatePosition(
    replay.header.frameCount,
    gameSpeeds.fastest
  );

  let reset: (() => void) | null = null;
  let _wasReset = false;

  const refreshScene = () => {
    images.clear();
    units.clear();
    unitsBySprite.clear();
    sprites.clear();
    cmds = commandsStream.generate();
    cmd = cmds.next();
    selectedUnitsStore().clearSelectedUnits();
    clearFollowedUnits();

    plugins.callHook(HOOK_ON_FRAME_RESET, openBw.call!.getCurrentFrame!());
    gameStatePosition.paused = false;

    currentBwFrame = null;
    reset = null;
    _wasReset = true;
  }

  const skipHandler = (dir: number, amount = 200) => {
    if (reset) return;
    const currentFrame = openBw.call!.getCurrentFrame!();
    openBw.call!.setCurrentFrame!(currentFrame + amount * dir);
    reset = refreshScene;
  }
  const skipForward = () => skipHandler(1);
  const skipBackward = () => skipHandler(-1);

  const speedHandler = (scale: number) => {
    const currentSpeed = openBw.call!.getGameSpeed!();
    openBw.call!.setGameSpeed!(Math.min(16, currentSpeed * scale));
  }
  const speedUp = () => speedHandler(2);
  const speedDown = () => speedHandler(0.5);
  const togglePause = () => {
    openBw.call!.setPaused!(!openBw.call!.isPaused!());
  }

  // const toggleMenuHandler = () => useHudStore.getState().toggleInGameMenu();

  const nextFrameHandler = (evt: KeyboardEvent) => {
    if (evt.code === "KeyN") {
      gameStatePosition.advanceGameFrames = 1;
    }
  };
  document.addEventListener("keydown", nextFrameHandler);
  janitor.callback(() =>
    document.removeEventListener("keydown", nextFrameHandler)
  );

  const _sceneResizeHandler = () => {
    gameSurface.setDimensions(window.innerWidth, window.innerHeight);

    const rect = gameSurface.getRect();
    gameStore().setDimensions({
      minimapWidth: rect.minimapWidth,
      minimapHeight: minimapSurface.canvas.style.display === "block" ? rect.minimapHeight : 0,
    });
    renderer.setSize(gameSurface.scaledWidth, gameSurface.scaledHeight);
    cssRenderer.setSize(gameSurface.scaledWidth, gameSurface.scaledHeight);

    camera.aspect = gameSurface.width / gameSurface.height;
    camera.updateProjectionMatrix();

    // players.forEach(({ camera }) =>
    //   camera.updateGameScreenAspect(gameSurface.width, gameSurface.height)
    // );

    minimapSurface.setDimensions(
      rect.minimapWidth,
      rect.minimapHeight,
    );

    controls.PIP.update();
  };

  const sceneResizeHandler = debounce(_sceneResizeHandler, 100);
  window.addEventListener("resize", sceneResizeHandler, false);
  janitor.callback(() =>
    window.removeEventListener("resize", sceneResizeHandler)
  );

  let currentBwFrame: FrameBW | null;

  const creep = new Creep(
    mapWidth,
    mapHeight,
    terrain.creepTextureUniform.value,
    terrain.creepEdgesTextureUniform.value
  );
  janitor.disposable(creep);

  const minimapImageData = new ImageData(mapWidth, mapHeight);
  const minimapResourceImageData = new ImageData(mapWidth, mapHeight);
  const resourceColor = new Color(0, 55, 55);
  const flashColor = new Color(200, 200, 200);

  const _buildMinimap = (unit: Unit, unitType: UnitDAT) => {
    const isResourceContainer = unitType.isResourceContainer && !unit.extras.player;
    if (
      (!isResourceContainer &&
        !fogOfWar.isVisible(tile32(unit.x), tile32(unit.y)))
    ) {
      return;
    }
    if (unitType.index === unitTypes.scannerSweep) {
      return;
    }

    let color;

    if (isResourceContainer) {
      color = resourceColor;
    } else if (unit.extras.player) {
      color = unit.extras.recievingDamage & 1 ? flashColor : unit.extras.player.color;
    } else {
      return;
    }

    let w = Math.floor(unitType.placementWidth / 32);
    let h = Math.floor(unitType.placementHeight / 32);

    if (unitType.isBuilding) {
      if (w > 4) w = 4;
      if (h > 4) h = 4;
    }
    if (w < 2) w = 2;
    if (h < 2) h = 2;

    const unitX = Math.floor(unit.x / 32);
    const unitY = Math.floor(unit.y / 32);
    const wX = Math.floor(w / 2);
    const wY = Math.floor(w / 2);

    const _out = isResourceContainer ? minimapResourceImageData : minimapImageData;
    const alpha = isResourceContainer ? 150 : 255;

    for (let x = -wX; x < wX; x++) {
      for (let y = -wY; y < wY; y++) {
        if (unitY + y < 0) continue;
        if (unitX + x < 0) continue;
        if (unitX + x >= mapWidth) continue;
        if (unitY + y >= mapHeight) continue;

        const pos = ((unitY + y) * mapWidth + unitX + x) * 4;

        _out.data[pos] = Math.floor(color.r * 255);
        _out.data[pos + 1] = Math.floor(color.g * 255);
        _out.data[pos + 2] = Math.floor(color.b * 255);
        _out.data[pos + 3] = alpha;
      }
    }
  }

  const buildMinimap = (imageData: ImageData, resourceImageData: ImageData) => {
    imageData.data.fill(0);
    resourceImageData.data.fill(0);

    for (const unit of unitsIterator()) {
      const dat = bwDat.units[unit.typeId];

      const showOnMinimap =
        unit.typeId !== unitTypes.darkSwarm &&
        unit.typeId !== unitTypes.disruptionWeb;

      if (showOnMinimap) {
        _buildMinimap(unit, dat);
      }
    }
  }

  const freeUnits: Unit[] = [];

  const getUnit = (units: Map<number, Unit>, unitData: UnitsBufferView) => {
    const unit = units.get(unitData.id);
    if (unit) {
      return unit;
    } else {
      const existingUnit = freeUnits.pop();

      const unit = Object.assign(existingUnit || {}, {
        extras: {
          recievingDamage: 0,
          dat: bwDat.units[unitData.typeId],
          player: undefined,
          warpingIn: undefined,
          warpingLen: undefined,
          selected: false,
        }
      });
      unitData.copyTo(unit)
      units.set(unitData.id, unit as unknown as Unit);
      plugins.callHook(HOOK_ON_UNIT_CREATED, unit);
      return unit as unknown as Unit;
    }
  }

  const unitBufferView = new UnitsBufferView(openBw.wasm);
  const unitList = new IntrusiveList(openBw.wasm.HEAPU32, 0, 43);

  function* unitsIterator() {
    const playersUnitAddr = openBw.call!.getUnitsAddr!();
    for (let p = 0; p < 12; p++) {
      unitList.addr = playersUnitAddr + (p << 3);
      for (const unitAddr of unitList) {
        const unitData = unitBufferView.get(unitAddr);
        const unit = units.get(unitData.id);
        if (unit) {
          yield unit;
        } else {
          log.error(`invalid access ${unitData.id}`);
        }
      }
    }
  }

  let unitAttackScore = {
    frequency: new Vector3(10, 20, 7.5),
    duration: new Vector3(1000, 1000, 1000),
    strength: new Vector3(),
    needsUpdate: false
  }

  const buildUnits = (
    units: Map<number, Unit>,
    unitsBySprite: Map<number, Unit>
  ) => {
    const deletedUnitCount = openBw.wasm!._counts(17);
    const deletedUnitAddr = openBw.wasm!._get_buffer(5);

    for (let i = 0; i < deletedUnitCount; i++) {
      const unitId = openBw.wasm!.HEAP32[(deletedUnitAddr >> 2) + i];
      const unit = units.get(unitId);
      if (!unit) continue;
      units.delete(unitId);
      freeUnits.push(unit);

      selectedUnitsStore().removeUnit(unit);
      unFollowUnit(unit);
      plugins.callHook(HOOK_ON_UNIT_KILLED, unit);
    }

    const playersUnitAddr = openBw.call!.getUnitsAddr!();

    for (let p = 0; p < 12; p++) {
      unitList.addr = playersUnitAddr + (p << 3);
      for (const unitAddr of unitList) {
        const unitData = unitBufferView.get(unitAddr);
        const unit = getUnit(units, unitData);

        unitsBySprite.set(unitData.spriteIndex, unit);

        //if receiving damage, blink 3 times, hold blink 3 frames
        if (
          !unit.extras.recievingDamage &&
          (unit.hp > unitData.hp || unit.shields > unitData.shields)
          && unit.typeId === unitData.typeId // ignore morphs
        ) {
          unit.extras.recievingDamage = 0b000111000111000111;
        } else if (unit.extras.recievingDamage) {
          unit.extras.recievingDamage = unit.extras.recievingDamage >> 1;
        }

        unit.extras.player = players.playersById[unitData.owner];

        // unit morph
        if (unit.typeId !== unitData.typeId) {
          unit.extras.dat = bwDat.units[unitData.typeId];
        }

        unitData.copyTo(unit);

        if (unit.extras.selected &&
          (unit.hp === 0 ||
            unit.order === orders.harvestGas ||
            (unit.statusFlags & UnitFlags.Loaded) !== 0 ||
            (unit.statusFlags & UnitFlags.InBunker) !== 0)) {
          selectedUnitsStore().removeUnit(unit);
        }

      }
    }
  }

  const bulletList = new IntrusiveList(openBw.wasm.HEAPU32, 0);

  const drawMinimap = (() => {
    const pipColor = "#aaaaaa"

    let _generatingMinimapFog = false;
    let _generatingUnits = false;
    let _generatingResources = false;
    let _generatingCreep = false;

    let fogBitmap: ImageBitmap;
    let unitsBitmap: ImageBitmap;
    let resourcesBitmap: ImageBitmap;
    let creepBitmap: ImageBitmap;

    const { canvas, ctx } = minimapSurface;

    return (view: ProjectedCameraView) => {
      if (!_generatingMinimapFog) {
        _generatingMinimapFog = true;

        createImageBitmap(fogOfWar.imageData).then((ib) => {
          fogBitmap = ib;
          _generatingMinimapFog = false;
        });
      }

      if (!_generatingUnits) {
        _generatingUnits = true;
        createImageBitmap(minimapImageData).then((ib) => {
          unitsBitmap = ib;
          _generatingUnits = false;
        });
      }

      if (!_generatingResources) {
        _generatingResources = true;
        createImageBitmap(minimapResourceImageData).then((ib) => {
          resourcesBitmap = ib;
          _generatingResources = false;
        });
      }

      if (!_generatingCreep) {
        _generatingCreep = true;
        createImageBitmap(creep.creepImageData).then((ib) => {
          creepBitmap = ib;
          _generatingCreep = false;
        });
      }

      if (!fogBitmap || !unitsBitmap || !resourcesBitmap || !creepBitmap) return;

      ctx.save();

      ctx.drawImage(
        terrain.minimapBitmap,
        0,
        0,
        canvas.width,
        canvas.height
      );

      if (creepBitmap) {
        ctx.drawImage(
          creepBitmap,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      if (unitsBitmap) {
        ctx.drawImage(
          unitsBitmap,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      if (fogBitmap && fogOfWar.enabled) {
        ctx.drawImage(
          fogBitmap,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      if (resourcesBitmap) {
        ctx.drawImage(
          resourcesBitmap,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      ctx.setTransform(
        canvas.width / mapWidth,
        0,
        0,
        canvas.height / mapHeight,
        canvas.width / 2,
        canvas.height / 2
      );

      controls.cameraMode.onDrawMinimap && controls.cameraMode.onDrawMinimap(ctx, view, _cameraTarget, _cameraPosition);

      if (controls.PIP.enabled) {
        const h = 5;
        const w = h * controls.PIP.camera.aspect;
        ctx.strokeStyle = pipColor;
        ctx.beginPath();
        ctx.moveTo(controls.PIP.camera.position.x - w, controls.PIP.camera.position.z - h);
        ctx.lineTo(controls.PIP.camera.position.x + w, controls.PIP.camera.position.z - h);
        ctx.lineTo(controls.PIP.camera.position.x + w, controls.PIP.camera.position.z + h);
        ctx.lineTo(controls.PIP.camera.position.x - w, controls.PIP.camera.position.z + h);
        ctx.lineTo(controls.PIP.camera.position.x - w, controls.PIP.camera.position.z - h);
        ctx.stroke();
      }
      ctx.restore();

    }
  })();


  const SoundPlayMaxDistance = 40;
  const buildSounds = (sounds: SoundStruct[]) => {
    for (const sound of sounds) {
      if (!fogOfWar.isVisible(tile32(sound.x), tile32(sound.y))) {
        continue;
      }
      const dat = assets.bwDat.sounds[sound.typeId];
      const mapCoords = terrain.getMapCoords(sound.x, sound.y)

      if (controls.cameraMode.soundMode === "spatial") {
        if (dat.minVolume || camera.position.distanceTo(mapCoords) < (controls.cameraMode.maxSoundDistance ?? SoundPlayMaxDistance)) {
          soundChannels.queue(sound, dat, mapCoords);
        }
      }
      else {
        const volume = getBwVolume(
          dat,
          mapCoords,
          sound,
          projectedCameraView.left,
          projectedCameraView.top,
          projectedCameraView.right,
          projectedCameraView.bottom
        );

        const pan = getBwPanning(sound, mapCoords, projectedCameraView.left, projectedCameraView.width);
        const classicSound = Object.assign({}, sound, {
          extra: {
            volume,
            pan
          }
        });
        if (volume > SoundPlayMinVolume) {
          soundChannels.queue(classicSound, dat, mapCoords);
        }
      }

    }
  };

  const buildCreep = (bwFrame: FrameBW) => {
    creep.generate(bwFrame.tiles, bwFrame.frame);
  };



  const calcSpriteCoordsXY = (x: number, y: number, v: Vector3, v2: Vector2, isFlying?: boolean) => {
    const spriteX = pxToGameUnit.x(x);
    const spriteZ = pxToGameUnit.y(y);
    let spriteY = terrain.getTerrainY(spriteX, spriteZ);
    const flyingY = isFlying ? 5.5 : spriteY;

    v2.set(spriteX, spriteZ);
    v.set(spriteX, flyingY, spriteZ);
  }
  const calcSpriteCoords = (sprite: SpritesBufferView, v: Vector3, v2: Vector2, isFlying?: boolean) => {
    calcSpriteCoordsXY(sprite.x, sprite.y, v, v2, isFlying);
  }
  const _spritePos = new Vector3();
  const _spritePos2d = new Vector2();
  const _targetSpritePos2d = new Vector2();
  const _targetSpritePos = new Vector3();
  const _ownerSpritePos = new Vector3();
  const _ownerSpritePos2d = new Vector2();

  // frequency, duration, strength multiplier
  const explosionFrequencyDuration = {
    [Explosion.Splash_Radial]: [6, 1.25, 1],
    [Explosion.Splash_Enemy]: [8, 1.25, 1],
    [Explosion.SplashAir]: [10, 1, 1],
    [Explosion.CorrosiveAcid]: [20, 0.75, 1],
    [Explosion.Normal]: [15, 0.75, 1],
    [Explosion.NuclearMissile]: [2, 3, 2],
    [Explosion.YamatoGun]: [4, 2, 1],
  };
  // strength, xyz index
  const bulletStrength = {
    [DamageType.Explosive]: [1, 0],
    [DamageType.Concussive]: [0.5, 1],
    [DamageType.Normal]: [0.25, 2],
  };
  const MaxShakeDistance = 30;

  const _cameraWorldDirection = new Vector3();

  const buildSprite = (spriteData: SpritesBufferView, _: number, bullet?: BulletsBufferView, weapon?: WeaponDAT) => {

    const unit = unitsBySprite.get(spriteData.index);
    let sprite = sprites.get(spriteData.index);
    if (!sprite) {
      sprite = new Group();
      sprite.name = "sprite";
      sprite.userData.selectionCircle = new SelectionCircle();
      sprite.add(sprite.userData.selectionCircle)
      sprites.set(spriteData.index, sprite);
      spritesGroup.add(sprite);
    }

    const dat = bwDat.sprites[spriteData.typeId];

    // doodads and resources are always visible
    // show units as fog is lifting from or lowering to explored
    // show if a building has been explored
    let spriteIsVisible =
      spriteData.owner === 11 ||
      dat.image.iscript === 336 ||
      dat.image.iscript === 337 ||
      fogOfWar.isSomewhatVisible(tile32(spriteData.x), tile32(spriteData.y));

    // sprites may be hidden (eg training units, flashing effects, iscript tmprmgraphicstart/end)
    //FIXME: make onShouldHideUnit a global plugin feature 
    if (spriteIsHidden(spriteData) || (unit && controls.cameraMode.onShouldHideUnit && controls.cameraMode.onShouldHideUnit(unit))) {
      spriteIsVisible = false;
    }

    const spriteRenderOrder = spriteSortOrder(spriteData as SpriteStruct) * 10;

    calcSpriteCoords(spriteData, _spritePos, _spritePos2d, unit && unitIsFlying(unit));
    let bulletY: number | undefined;

    const player = players.playersById[spriteData.owner];

    if (bullet && bullet.spriteIndex !== 0 && weapon && spriteIsVisible) {

      const exp = explosionFrequencyDuration[weapon.explosionType as keyof typeof explosionFrequencyDuration];
      const _bulletStrength = bulletStrength[weapon.damageType as keyof typeof bulletStrength];

      //FIXME:L make camera shake params more accessible
      if (controls.cameraMode.cameraShake && bullet.state === BulletState.Dying && _bulletStrength && !(exp === undefined || weapon.damageType === DamageType.IgnoreArmor || weapon.damageType === DamageType.Independent)) {
        const distance = camera.position.distanceTo(_spritePos);
        if (distance < MaxShakeDistance) {
          const calcStrength = _bulletStrength[0] * easeCubicIn(1 - distance / MaxShakeDistance) * exp[2];
          if (calcStrength > unitAttackScore.strength.getComponent(_bulletStrength[1])) {
            unitAttackScore.strength.setComponent(_bulletStrength[1], calcStrength);
            unitAttackScore.duration.setComponent(_bulletStrength[1], exp[1] * 1000);
            unitAttackScore.frequency.setComponent(_bulletStrength[1], exp[0]);
            unitAttackScore.needsUpdate = true;
          }
        }
      }

      if (weapon.weaponBehavior === WeaponBehavior.AppearOnTargetUnit && bullet.targetUnit) {
        calcSpriteCoords(bullet.targetUnit.owSprite, _targetSpritePos, _targetSpritePos2d, bwDat.units[bullet.targetUnit.typeId].isFlyer);
        bulletY = _targetSpritePos.y;
        // appear on attacker: dark swarm/scarab/stasis field (visible?)
      } else if ((weapon.weaponBehavior === WeaponBehavior.AppearOnAttacker || weapon.weaponBehavior === WeaponBehavior.AttackTarget_3x3Area) && bullet.ownerUnit) {
        calcSpriteCoords(bullet.ownerUnit.owSprite, _ownerSpritePos, _ownerSpritePos2d, bwDat.units[bullet.ownerUnit.typeId].isFlyer);
        bulletY = _ownerSpritePos.y;
      } else if (weapon.weaponBehavior === WeaponBehavior.FlyAndDontFollowTarget && bullet.targetUnit && bullet.ownerUnit) {
        calcSpriteCoordsXY(bullet.targetPosX, bullet.targetPosY, _targetSpritePos, _targetSpritePos2d, bwDat.units[bullet.targetUnit.typeId].isFlyer);
        calcSpriteCoords(bullet.ownerUnit.owSprite, _ownerSpritePos, _ownerSpritePos2d, bwDat.units[bullet.ownerUnit.typeId].isFlyer);

        const unitDistances = _ownerSpritePos2d.distanceTo(_targetSpritePos2d);
        const bulletDistanceToTarget = _spritePos2d.distanceTo(_targetSpritePos2d);

        bulletY = MathUtils.lerp(_targetSpritePos.y, _ownerSpritePos.y, bulletDistanceToTarget / unitDistances);
      }
      else if ((weapon.weaponBehavior === WeaponBehavior.FlyAndFollowTarget || weapon.weaponBehavior === WeaponBehavior.Bounce) && bullet.targetUnit) {
        const prevUnit = bullet.prevBounceUnit ?? bullet.ownerUnit;
        if (prevUnit) {
          calcSpriteCoords(bullet.targetUnit.owSprite, _targetSpritePos, _targetSpritePos2d, bwDat.units[bullet.targetUnit.typeId].isFlyer);
          calcSpriteCoords(prevUnit.owSprite, _ownerSpritePos, _ownerSpritePos2d, bwDat.units[prevUnit.typeId].isFlyer);

          const unitDistances = _ownerSpritePos2d.distanceTo(_targetSpritePos2d);
          const bulletDistanceToTarget = _spritePos2d.distanceTo(_targetSpritePos2d);

          bulletY = MathUtils.lerp(_targetSpritePos.y, _ownerSpritePos.y, bulletDistanceToTarget / unitDistances);
        }
      }
    }

    // floating terran buildings

    let imageCounter = 1;
    sprite.position.x = _spritePos.x;
    sprite.position.z = _spritePos.z;
    sprite.position.y = bulletY ?? _spritePos.y;
    sprite.renderOrder = spriteRenderOrder;
    sprite.lookAt(sprite.position.x - _cameraWorldDirection.x, sprite.position.y - _cameraWorldDirection.y, sprite.position.z - _cameraWorldDirection.z);

    // we do it in the image loop in order to use the right image scale
    // is there a better ways so we can do it properly at the sprite level?
    if (unit && unit.extras.selected) {
      sprite.userData.selectionCircle.update(dat);
      sprite.userData.selectionCircle.visible = true;
    } else {
      sprite.userData.selectionCircle.visible = false;
    }

    for (const imgAddr of spriteData.images.reverse()) {
      const imageData = imageBufferView.get(imgAddr);

      let image = images.get(imageData.index);
      if (!image) {
        image = createImage(imageData.typeId);
        images.set(imageData.index, image);
      }
      image.visible = spriteIsVisible && !imageIsHidden(imageData as ImageStruct);
      image.userData.unit = unit;

      if (image.visible) {
        if (player) {
          image.setTeamColor(player.color);
        }

        image.position.x = imageData.x / 32;
        image.position.z = 0;
        // flying building or drone, don't use 2d offset
        image.position.y = imageIsFrozen(imageData) ? 0 : -imageData.y / 32;

        // if we're a shadow, we act independently from a sprite since our Y coordinate
        // needs to be in world space
        if (image.dat.drawFunction === drawFunctions.rleShadow && unit && unitIsFlying(unit)) {
          image.position.x = _spritePos.x;
          image.position.z = _spritePos.z;
          image.position.y = terrain.getTerrainY(_spritePos.x, _spritePos.z);

          image.rotation.copy(sprite.rotation);
          image.renderOrder = - 1;
          if (image.parent !== spritesGroup) {
            spritesGroup.add(image);
          }
        } else {
          image.rotation.set(0, 0, 0);
          image.renderOrder = spriteRenderOrder + imageCounter;
          if (image.parent !== sprite) {
            sprite.add(image);
          }
        }


        // 63-48=15
        if (imageData.modifier === 14) {
          image.setWarpingIn((imageData.modifierData1 - 48) / 15);
        } else {
          image.setWarpingIn(0);
        }
        //FIXME: use modifier 1 for opacity value
        image.setCloaked(imageData.modifier === 2 || imageData.modifier === 5);

        if (imageHasDirectionalFrames(imageData as ImageStruct)) {
          const flipped = imageIsFlipped(imageData as ImageStruct);
          const direction = flipped ? 32 - imageData.frameIndexOffset : imageData.frameIndexOffset;
          const newFrameOffset = (direction + camera.userData.direction) % 32;

          if (newFrameOffset > 16) {
            image.setFrame(imageData.frameIndexBase + 32 - newFrameOffset, true);
          } else {
            image.setFrame(imageData.frameIndexBase + newFrameOffset, false);
          }
        } else {
          image.setFrame(imageData.frameIndex, imageIsFlipped(imageData as ImageStruct));
        }



        if (imageData.index === spriteData.mainImageIndex) {


          // if (unit ) {
          // for 3d models
          // image.rotation.y = unit.angle;
          // }
        }

        if (imageNeedsRedraw(imageData as ImageStruct)) {
          image.updateMatrix();
        }
      }
      imageCounter++;
    }
  }

  const spriteBufferView = new SpritesBufferView(openBw.wasm);
  const imageBufferView = new ImageBufferView(openBw.wasm);
  const bulletBufferView = new BulletsBufferView(openBw.wasm);
  const _ignoreSprites: number[] = [];

  const buildSprites = (delta: number) => {
    const deleteImageCount = openBw.wasm!._counts(15);
    const deletedSpriteCount = openBw.wasm!._counts(16);
    const deletedImageAddr = openBw.wasm!._get_buffer(3);
    const deletedSpriteAddr = openBw.wasm!._get_buffer(4);

    camera.getWorldDirection(_cameraWorldDirection);

    // avoid image flashing by clearing the group here when user is scrubbing through a replay
    if (_wasReset) {
      spritesGroup.clear();
      _wasReset = false;
    }

    for (let i = 0; i < deletedSpriteCount; i++) {
      const spriteIndex = openBw.wasm!.HEAP32[(deletedSpriteAddr >> 2) + i];
      unitsBySprite.delete(spriteIndex);

      const sprite = sprites.get(spriteIndex);
      if (!sprite) continue;
      sprite.removeFromParent();
      sprites.delete(spriteIndex);
    }

    for (let i = 0; i < deleteImageCount; i++) {
      const imageIndex = openBw.wasm!.HEAP32[(deletedImageAddr >> 2) + i];
      const image = images.get(imageIndex);
      if (!image) continue;
      image.removeFromParent();
      images.delete(imageIndex);
      delete image.userData.unit;
      freeImages.push(image);
    }

    // build bullet sprites first since they need special Y calculations
    bulletList.addr = openBw.call!.getBulletsAddress!();
    _ignoreSprites.length = 0;
    for (const bulletAddr of bulletList) {
      if (bulletAddr === 0) continue;

      const bullet = bulletBufferView.get(bulletAddr);
      const weapon = bwDat.weapons[bullet.weaponTypeId];

      // if (bullet.weaponTypeId === WeaponType.FusionCutter_Harvest || bullet.weaponTypeId === WeaponType.ParticleBeam_Harvest || bullet.weaponTypeId === WeaponType.Spines_Harvest || weapon.weaponBehavior === WeaponBehavior.AppearOnTargetPos) {
      //   continue;
      // }

      buildSprite(bullet.owSprite, delta, bullet, weapon);
      _ignoreSprites.push(bullet.spriteIndex);
    }

    // build all remaining sprites
    const spriteList = new IntrusiveList(openBw.wasm!.HEAPU32);
    const spriteTileLineSize = openBw.call!.getSpritesOnTileLineSize!();
    const spritetileAddr = openBw.call!.getSpritesOnTileLineAddress!();
    for (let l = 0; l < spriteTileLineSize; l++) {
      spriteList.addr = spritetileAddr + (l << 3)
      for (const spriteAddr of spriteList) {
        if (spriteAddr === 0) {
          continue;
        }

        const spriteData = spriteBufferView.get(spriteAddr);
        if (_ignoreSprites.includes(spriteData.index)) {
          continue;
        }

        buildSprite(spriteData, delta);
      }
    }
  };

  let _lastElapsed = 0;
  let delta = 0;

  let cmds = commandsStream.generate();

  const _stepperListener = (evt: KeyboardEvent) => {
    if (evt.key === "n" && gameStatePosition.mode === GameStatePlayMode.SingleStep) {
      gameStatePosition.paused = false;
    }
  };

  window.addEventListener("keypress", _stepperListener);
  janitor.callback(() => { window.removeEventListener("keypress", _stepperListener) });

  const _boundaryMin = new Vector3(-mapWidth / 2, 0, -mapHeight / 2);
  const _boundaryMax = new Vector3(mapWidth / 2, 0, mapHeight / 2);
  const _cameraBoundaryBox = new Box3(_boundaryMin, _boundaryMax)
  const _commandsThisFrame: any[] = [];

  let cmd = cmds.next();

  const GAME_LOOP = (elapsed: number) => {
    delta = elapsed - _lastElapsed;
    _lastElapsed = elapsed;

    projectedCameraView.update();

    controls.orbit.getTarget(_cameraTarget);
    controls.orbit.getPosition(_cameraPosition);
    controls.orbit.update(delta / 1000);
    cameraMouse.update(delta / 100, elapsed, controls.cameraMode);
    cameraKeys.update(delta / 100, elapsed, controls.cameraMode);
    minimapMouse.update(controls.orbit, controls.PIP);

    if (reset) {
      reset();
    }

    if (!gameStatePosition.paused) {
      if (!currentBwFrame) {

        currentBwFrame = gameStateReader.next();
        if (!currentBwFrame) {
          gameStatePosition.paused = true;
        } else if (currentBwFrame.needsUpdate === false) {
          currentBwFrame = null;
        }
      }
    }

    if (gameStatePosition.advanceGameFrames && currentBwFrame) {
      buildSounds(openBw.call!.getSoundObjects!());
      buildCreep(currentBwFrame);

      gameStatePosition.bwGameFrame = currentBwFrame.frame;
      if (gameStatePosition.bwGameFrame % 8 === 0) {
        scene.incrementTileAnimation();
      }

      buildUnits(
        units,
        unitsBySprite
      );
      buildMinimap(minimapImageData, minimapResourceImageData);
      buildSprites(delta);
      // buildResearchAndUpgrades(currentBwFrame);
      fogOfWar.texture.needsUpdate = true;
      creep.creepValuesTexture.needsUpdate = true;
      creep.creepEdgesValuesTexture.needsUpdate = true;

      const audioPosition = controls.cameraMode.onUpdateAudioMixerLocation(delta, elapsed, _cameraTarget, _cameraPosition);
      audioMixer.updateFromVector3(audioPosition as Vector3, delta);

      soundChannels.play(elapsed);

      if (unitAttackScore.needsUpdate) {
        controls.cameraShake.shake(elapsed, unitAttackScore.duration, unitAttackScore.frequency, unitAttackScore.strength);
        unitAttackScore.needsUpdate = false;
        unitAttackScore.strength.setScalar(0);
      }


      _commandsThisFrame.length = 0;
      while (cmd.done === false) {
        if (
          typeof cmd.value === "number"
        ) {
          if (cmd.value > gameStatePosition.bwGameFrame) {
            break;
          }
          // only include past 5 game seconds (in case we are skipping frames)
        } else if (gameStatePosition.bwGameFrame - cmd.value.frame < 120) {
          _commandsThisFrame.push(cmd.value);
        }
        cmd = cmds.next();
      }

      renderer.getWebGLRenderer().shadowMap.needsUpdate = true;
      plugins.onFrame(gameStatePosition, openBw.wasm!._get_buffer(8), openBw.wasm!._get_buffer(9), _commandsThisFrame, followedUnits);

      currentBwFrame = null;
    }


    {
      const dir = controls.cameraMode.rotateSprites ? getDirection32(projectedCameraView.center, camera.position) : 0;
      if (dir != camera.userData.direction) {
        camera.userData.prevDirection = camera.userData.direction;
        camera.userData.direction = dir;
        if (currentBwFrame) {
          currentBwFrame.needsUpdate = true;
        }
      }
    }

    if (controls.cameraMode.boundByMap?.scaleBoundsByCamera && controls.rested) {
      _cameraBoundaryBox.set(_boundaryMin.set(-mapWidth / 2 + projectedCameraView.width / 2.5, 0, -mapHeight / 2 + projectedCameraView.height / 2.5), _boundaryMax.set(mapWidth / 2 - projectedCameraView.width / 2.5, 0, mapHeight / 2 - projectedCameraView.height / 2.5));
      controls.orbit.setBoundary(_cameraBoundaryBox);
    }

    renderer.targetSurface = gameSurface;

    gameStatePosition.update(delta);
    drawMinimap(projectedCameraView);

    plugins.onBeforeRender(delta, elapsed, _cameraTarget, _cameraPosition);
    controls.cameraShake.update(elapsed, camera);
    fogOfWar.update(players.getVisionFlag(), camera);
    renderer.render(delta);
    controls.cameraShake.restore(camera);

    if (controls.PIP.enabled) {
      const scale = ImageHD.useScale;
      setUseScale(1);
      fogOfWar.update(players.getVisionFlag(), controls.PIP.camera);
      renderer.changeCamera(controls.PIP.camera);
      renderer.render(delta, controls.PIP.viewport);
      renderer.changeCamera(camera);
      setUseScale(scale);
    }

    let _cssItems = 0;
    for (const cssItem of cssScene.children) {
      _cssItems += cssItem.children.length;
    }
    if (_cssItems) {
      cssRenderer.render(cssScene, camera);
    }

    fps.update(elapsed);
    plugins.onRender(delta, elapsed);

  };

  const dispose = () => {
    log.info("disposing replay viewer");
    gameStatePosition.pause();
    clearFollowedUnits();
    plugins.onGameDisposed();
    pluginsApiJanitor.mopUp();
    janitor.mopUp();
    controls.cameraMode.dispose();
    selectedUnitsStore().clearSelectedUnits();

  };

  window.onbeforeunload = dispose;

  {
    const unsub = useSettingsStore.subscribe((state) => {
      Object.assign(settings, state.data);
      renderer.gamma = settings.graphics.gamma;
      audioMixer.masterVolume = settings.audio.global;
      audioMixer.musicVolume = settings.audio.music;
      audioMixer.soundVolume = settings.audio.sound;
    });
    janitor.callback(unsub);
  }

  // force layout recalc
  _sceneResizeHandler();

  gameStatePosition.resume();
  const originalColors = replay.header.players.map(player => player.color);
  const originalNames = replay.header.players.map(player => ({
    id: player.id,
    name: player.name
  }));

  let pluginsApiJanitor = new Janitor;

  const setupPlugins = async () => {
    shortcuts.clearAll();

    const toggleFogOfWarByPlayerId = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (player) {
        player.vision = !player.vision;
        fogOfWar.forceInstantUpdate = true;
      }
    }


    const setPlayerColors = (colors: string[]) => {
      const replay = useWorldStore.getState().replay;

      if (replay) {
        replay.header.players.forEach((player, i) => {
          player.color = colors[i];
        });
        useWorldStore.setState({ replay: { ...replay } })
      }
    }

    const getOriginalColors = () => [...originalColors];

    const setPlayerNames = (players: { name: string, id: number }[]) => {
      const replay = useWorldStore.getState().replay;

      if (replay) {
        for (const player of players) {
          const replayPlayer = replay.header.players.find(p => p.id === player.id);
          if (replayPlayer) {
            replayPlayer.name = player.name;
          }
        }
        useWorldStore.setState({ replay: { ...replay } })
      }
    }

    const getOriginalNames = () => [...originalNames];

    const api = {
      isInGame: true,
      scene,
      cssScene,
      assets,
      toggleFogOfWarByPlayerId,
      unitsIterator,
      projectedCameraView,
      skipForward,
      skipBackward,
      speedUp,
      speedDown,
      togglePause,
      pxToGameUnit,
      fogOfWar,
      terrain: {
        tileset: terrain.tileset,
        mapWidth: terrain.mapWidth,
        mapHeight: terrain.mapHeight,
        getTerrainY: terrain.getTerrainY,
        getMapCoords: terrain.getMapCoords,
        terrain: terrain.terrain
      },
      getFrame() {
        return currentBwFrame?.frame;
      },
      maxFrame: replay.header.frameCount,
      gotoFrame: (frame: number) => openBw.call!.setCurrentFrame!(frame),
      getSpeed: () => openBw.call!.getGameSpeed!(),
      registerHotkey(key: string, fn: Function) {
        // @ts-ignore
        shortcuts.addListener(this.id, key, fn);
      },
      // @ts-ignore
      clearHotkeys() { shortcuts.clearListeners(this.id) },
      exitCameraMode: () => {
        shortcuts.pressKey("Escape")
      },
      pipLookAt(x: number, z: number) {
        controls.PIP.enabled = true;
        controls.PIP.camera.position.set(x, controls.PIP.camera.position.y, z);
        controls.PIP.camera.lookAt(x, 0, z);
      },
      setPipDimensions(position?: Vector2, height?: number) {
        if (position) {
          controls.PIP.position = position;
        } else {
          delete controls.PIP.position;
        }

        if (height) {
          controls.PIP.height = height;
        }

        controls.PIP.update();
      },
      pipHide() {
        controls.PIP.enabled = false;
      },
      setPlayerColors,
      getOriginalColors,
      setPlayerNames,
      getOriginalNames,
      getPlayers: () => [...replay.header.players.map(p => ({ ...p }))],
      replay: { ...replay.header, players: [...replay.header.players.map(p => ({ ...p }))] },
      getFPS: () => fps.fps,
      calculateFollowedUnitsTarget
    };

    pluginsApiJanitor.callback(plugins.injectApi(api));

    let switchingCameraMode = false;
    plugins.getCameraModePlugins().forEach((cameraMode) => {
      const _toggleCallback = async () => {
        if (switchingCameraMode) return;

        if (cameraMode !== controls.cameraMode) {
          switchingCameraMode = true;
          controls = await switchCameraMode(cameraMode, controls.cameraMode);
        }
        switchingCameraMode = false;
      }
      shortcuts.addListener(cameraMode.id, cameraMode.config.cameraModeKey!, _toggleCallback);
      pluginsApiJanitor.callback(() => shortcuts.removeListener(_toggleCallback));

    });

    await plugins.callHookAsync(HOOK_ON_GAME_READY);

  }
  await setupPlugins();
  renderer.getWebGLRenderer().setAnimationLoop(GAME_LOOP);

  const _onReloadPlugins = async () => {
    pluginsApiJanitor.mopUp();
    renderer.getWebGLRenderer().setAnimationLoop(null);
    await (settingsStore().load());
    plugins.initializePluginSystem(settingsStore().enabledPlugins);
    controls = await switchCameraMode(plugins.getDefaultCameraModePlugin());

    await setupPlugins();
    renderer.getWebGLRenderer().setAnimationLoop(GAME_LOOP);
  };

  ipcRenderer.on(RELOAD_PLUGINS, _onReloadPlugins);
  janitor.callback(() => ipcRenderer.off(RELOAD_PLUGINS, _onReloadPlugins));

  return dispose;
}

export default TitanReactorGame;
