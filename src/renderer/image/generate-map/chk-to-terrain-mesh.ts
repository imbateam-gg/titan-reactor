import type Chk from "bw-chk";
import { GeometryOptions, UnitTileScale } from "common/types";
import {
  createDataTextures, createTerrainGeometryFromQuartiles, extractBitmaps, defaultGeometryOptions, transformLevelConfiguration, doHeightMapEffect
} from ".";

import * as log from "@ipc";
import { getTilesetBuffers } from "./get-tileset-buffers";

import * as sd from "./sd";
import * as hd from "./hd";
import { renderComposer } from "@render";
import { parseDdsGrpAsTextures } from "..";
import parseDDS from "@image/formats/parse-dds";
import { parseTMSK } from "@image/formats/parse-tmsk";
import { Creep } from "@core/creep/creep";
import Janitor from "@utils/janitor";

export async function chkToTerrainMesh(chk: Chk, textureResolution: UnitTileScale, geomOptions: GeometryOptions = defaultGeometryOptions) {
  const janitor = new Janitor();
  const [mapWidth, mapHeight] = chk.size;

  const tilesetBuffers = await getTilesetBuffers(chk.tileset, chk._tiles);
  const bitmaps = await extractBitmaps(mapWidth, mapHeight, tilesetBuffers);
  const dataTextures = await createDataTextures({
    blendNonWalkableBase: geomOptions.blendNonWalkableBase,
    palette: tilesetBuffers.paletteWPE, mapWidth, mapHeight, bitmaps,
  });

  const levels = transformLevelConfiguration(geomOptions.elevationLevels, geomOptions.normalizeLevels);

  const { creepGrpSD, paletteWPE: palette, hdTiles, creepGrpHD, tilegroupCV5: tilegroupU16, tileset, megatilesVX4: megatiles, minitilesVR4: minitiles } = tilesetBuffers;

  log.verbose(`Generating terrain textures`);


  const renderer = renderComposer.getWebGLRenderer();

  //TODO: properly dispose stuff in here
  const heightMaps = await doHeightMapEffect({
    palette,
    tileset,
    mapWidth,
    mapHeight,
    dataTextures,
    geomOptions,
    levels,
    renderer
  });

  const isLowRes = textureResolution === UnitTileScale.SD;

  renderComposer.preprocessStart();

  renderer.clear();
  const creepTexture = isLowRes ? sd.grpToCreepTexture(palette, megatiles, minitiles, tilegroupU16) : hd.ddsToCreepTexture(hdTiles, tilegroupU16, textureResolution, renderer);

  renderer.clear();
  const creepEdgesTexture = isLowRes ? await sd.grpToCreepEdgesTextureAsync(creepGrpSD, palette) : hd.ddsToCreepEdgesTexture(creepGrpHD, textureResolution, renderer);

  renderer.clear();
  const textures = isLowRes ? sd.createSdQuartiles(mapWidth, mapHeight, bitmaps.diffuse) : hd.createHdQuartiles(mapWidth, mapHeight,
    hdTiles,
    bitmaps.mapTilesData,
    textureResolution, renderer
  );

  const effectsTextures = {
    waterNormal1: parseDdsGrpAsTextures(tilesetBuffers.waterNormal1),
    waterNormal2: parseDdsGrpAsTextures(tilesetBuffers.waterNormal2),
    noise: await parseDDS(tilesetBuffers.noise, false),
    waterMask: tilesetBuffers.waterMask ? parseDdsGrpAsTextures(tilesetBuffers.waterMask) : null,
    tileMask: tilesetBuffers.tileMask ? parseTMSK(tilesetBuffers.tileMask) : null,
    dispose() {
      janitor.dispose(this.waterNormal1, this.waterNormal2);
      this.waterMask && janitor.dispose(this.waterMask);
    }
  }

  renderComposer.preprocessEnd();

  const terrain = await createTerrainGeometryFromQuartiles(mapWidth, mapHeight, creepTexture, creepEdgesTexture, geomOptions, dataTextures, heightMaps, textures, effectsTextures);

  const creep = new Creep(
    mapWidth,
    mapHeight,
    dataTextures.creepTextureUniform.value,
    dataTextures.creepEdgesTextureUniform.value
  );

  return {
    terrain,
    dataTextures,
    creep,
    heightMaps,
    dispose() {
      janitor.dispose(
        creep,
        terrain,
        textures.mapQuartiles.flat(),
        effectsTextures
      );
    }
  }
}