import loadScm from "./utils/load-scm";

import Chk from "bw-chk";
import {
  ImageHD,
} from "./core";
import * as log from "./ipc/log";
import { Scene } from "./render";
import loadTerrain from "./image/generate-map/load-terrain";
import gameStore from "./stores/game-store";
import processStore, { Process } from "./stores/process-store";
import screenStore from "./stores/screen-store";
import { ScreenType } from "../common/types";
import TitanReactorMap from "./view-map";
import waitForAssets from "./utils/wait-for-assets";
import { cleanMapTitles } from "@utils/map-string-utils";
import { useWorldStore } from "./stores";


const updateWindowTitle = (title: string) => {
  document.title = `Titan Reactor - ${title}`;
}
export default async (chkFilepath: string) => {

  gameStore().disposeGame();

  processStore().start(Process.MapInitialization, 3);

  screenStore().init(ScreenType.Map);

  log.verbose("loading chk");
  let chk: Chk;

  try {
    chk = new Chk(await loadScm(chkFilepath));
  } catch (e) {
    screenStore().setError(e instanceof Error ? e : new Error("Invalid chk"));
    return;
  }
  cleanMapTitles(chk);

  //FIXME: add janitor
  useWorldStore.setState({
    map: chk
  });

  updateWindowTitle(chk.title);

  await waitForAssets();

  processStore().increment(Process.MapInitialization);

  log.verbose("initializing scene");
  const terrainInfo = await loadTerrain(chk);
  const scene = new Scene(terrainInfo);

  ImageHD.useDepth = false;
  processStore().increment(Process.MapInitialization);

  log.verbose("initializing gameloop");
  const disposeGame = await TitanReactorMap(
    chk,
    terrainInfo,
    scene
  );
  processStore().increment(Process.MapInitialization);

  gameStore().setDisposeGame(disposeGame);
  processStore().complete(Process.MapInitialization);
  screenStore().complete();
};
