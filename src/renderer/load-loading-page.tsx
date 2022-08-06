import sceneStore from "@stores/scene-store";
import { SceneState, SettingsMeta } from "common/types";
import settingsStore from "./stores/settings-store";
import * as pluginSystem from "./plugins";
import { initializePluginSystem } from "./plugins";
import processStore, { Process } from "@stores/process-store";
import loadAndParseAssets from "./assets/load-and-parse-assets";
import * as log from "./ipc/log";
import { playIntroAudio, preloadIntro } from "./home/wraith-scene";
import { root } from "./render/root";
import { SceneLoadingUI } from "./home/loading";
import { waitForSeconds } from "@utils/wait-for-process";

const tryLoad = async (settings: SettingsMeta) => {
  sceneStore().clearError();

  if (settings.errors.length) {
    const error = `@init: error with settings - ${settings.errors.join(", ")}`;
    log.error(error);
    throw new Error(error);
  }

  if (
    processStore().isComplete(Process.AtlasPreload) ||
    processStore().isInProgress(Process.AtlasPreload)
  ) {
    return;
  }
  await loadAndParseAssets(settings.data);
};

export async function loadLoadingPage(): Promise<SceneState> {
  log.info("@init: loading settings");
  root.render(<SceneLoadingUI />);
  const settings = await settingsStore().load();

  await initializePluginSystem(settingsStore().enabledPlugins);
  document.body.addEventListener("mouseup", (evt) => pluginSystem.onClick(evt));

  await tryLoad(settings);
  await preloadIntro();

  //todo: subscribe to settings changes in order to resolve initial settings issues for users
  return {
    id: "@loading",
    start: async () => {
      playIntroAudio();
      await waitForSeconds(3);
    },
    dispose: () => {},
  };
}
