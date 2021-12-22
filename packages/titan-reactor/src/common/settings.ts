import { Settings} from "./types"

export const RenderMode = {
  SD: 0,
  HD: 1,
  ThreeD: 2,
};

export const ShadowLevel = {
  Off: 0,
  Low: 1,
  Medium: 2,
  High: 3,
};

export const GameAspect = {
  Fit: "Fit",
  Native: "Native",
  FourThree: "FourThree",
  SixteenNine: "SixteenNine",
};

export const SETTINGS_VERSION = 1;

export const defaultSettings: Settings = {
    version: SETTINGS_VERSION,
    renderMode: RenderMode.HD,
    alwaysHideReplayControls: false,
    language: "en-US",
    starcraftPath: "",
    mapsPath: "",
    replaysPath: "",
    tempPath: "",
    communityModelsPath: "",
    observerLink: "",
    musicVolume: 0.1,
    musicAllTypes: false,
    soundVolume: 1,
    antialias: false,
    anisotropy: 1,
    pixelRatio: 1,
    gamma: 1.2,
    keyPanSpeed: 0.5,
    twitch: "",
    fullscreen: true,
    enablePlayerScores: true,
    esportsHud: true,
    embedProduction: true,
    cameraShake: 1,
    useCustomColors: false,
    randomizeColorOrder: false,
    classicClock: false,
    playerColors: [
      "#f40404",
      "#0c48cc",
      "#2cb494",
      "#88409c",
      "#f88c14",
      "#703014",
      "#cce0d0",
      "#fcfc38",
    ],
    hudFontSize: "sm",
    minimapRatio: 25,
    replayAndUnitDetailSize: "24vw",
    fpsLimit: 200,
    autoToggleProductionView: true,
    showDisabledDoodads: false,
    showCritters: true,
    mouseRotateSpeed: 0.1,
    mouseDollySpeed: 0.1,
    mapBackgroundColor: "#000000",
  };