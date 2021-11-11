import { ReadFile } from "../../types";
import { WebGLRenderer } from "three";

import readDdsGrp from "../formats/dds-grp";
import GameIcons from "./game-icons";

export default async (readFile: ReadFile) => {
  const renderer = new WebGLRenderer({
    depth: false,
    stencil: false,
    alpha: true,
  });
  renderer.autoClear = false;

  const palette = new Uint8Array(
    (await readFile("TileSet/jungle.wpe")).buffer
  ).slice(0, 1024);

  const gameIcons = new GameIcons();
  gameIcons.renderResourceIcons(
    renderer,
    readDdsGrp(await readFile("game/icons.dds.grp"))
  );

  const cmdIcons = new GameIcons();
  cmdIcons.renderCmdIcons(
    renderer,
    readDdsGrp(await readFile("HD2/unit/cmdicons/cmdicons.dds.grp"))
  );

  const raceInsetIcons = new GameIcons();
  raceInsetIcons.renderRaceInset(
    renderer,
    readDdsGrp(await readFile("glue/scoretd/iScore.dds.grp"))
  );

  const arrowIcons = new GameIcons();
  await arrowIcons.renderCursor(await readFile("cursor/arrow.grp"), palette);

  const hoverIcons = new GameIcons();
  await hoverIcons.renderCenteredCursor(
    await readFile("cursor/MagY.grp"),
    palette
  );

  const dragIcons = new GameIcons();
  await dragIcons.renderCenteredCursor(
    await readFile("cursor/Drag.grp"),
    palette
  );

  const wireframeIcons = new GameIcons();
  await wireframeIcons.renderWireframes(
    renderer,
    readDdsGrp(await readFile("HD2/unit/wirefram/wirefram.dds.grp"))
  );

  const workerIcons = {
    apm: `data:image/png;base64,${(
      await readFile("webui/dist/lib/images/icon_apm.png")
    ).toString("base64")}`,
    terran: `data:image/png;base64,${(
      await readFile("webui/dist/lib/images/icon_worker_terran.png")
    ).toString("base64")}`,
    zerg: `data:image/png;base64,${(
      await readFile("webui/dist/lib/images/icon_worker_zerg.png")
    ).toString("base64")}`,
    protoss: `data:image/png;base64,${(
      await readFile("webui/dist/lib/images/icon_worker_protoss.png")
    ).toString("base64")}`,
  };

  renderer.dispose();
  //@todo not all of these are GameIcons?
  return [
    gameIcons,
    cmdIcons.icons,
    raceInsetIcons,
    workerIcons,
    arrowIcons,
    hoverIcons,
    dragIcons,
    wireframeIcons,
  ];
};
