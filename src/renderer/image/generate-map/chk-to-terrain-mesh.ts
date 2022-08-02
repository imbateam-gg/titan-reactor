import type Chk from "bw-chk";
import { GeometryOptions, TerrainExtra, TerrainInfo, UnitTileScale } from "common/types";
import {
  createDataTextures, createTerrainGeometryFromQuartiles, extractBitmaps, defaultGeometryOptions, transformLevelConfiguration, dataTexturesToHeightMaps, getTerrainY as genTerrainY
} from ".";

import * as log from "@ipc";
import { getTilesetBuffers } from "./get-tileset-buffers";

import * as sd from "./sd";
import * as hd from "./hd";
import { anisotropyOptions } from "@utils/renderer-utils";
import { Layers } from "../../render/layers";
import { LinearEncoding, Mesh, sRGBEncoding } from "three";
import renderComposer from "../../render/render-composer";
import { parseDdsGrpAsTextures } from "..";
import parseDDS from "@image/formats/parse-dds";
import { parseTMSK } from "@image/formats/parse-tmsk";

type TerrainMeshSettings = {
  textureResolution: UnitTileScale;
  anisotropy: string;
  shadows: boolean;
}

export default async function chkToTerrainMesh(chk: Chk, settings: TerrainMeshSettings, geomOptions: GeometryOptions = defaultGeometryOptions): Promise<{ terrain: TerrainInfo, extra: TerrainExtra }> {
  const [mapWidth, mapHeight] = chk.size;

  const tilesetBuffers = await getTilesetBuffers(chk.tileset, chk._tiles);
  const bitmaps = await extractBitmaps(mapWidth, mapHeight, tilesetBuffers);
  const dataTextures = await createDataTextures({
    blendNonWalkableBase: geomOptions.blendNonWalkableBase,
    palette: tilesetBuffers.palette, mapWidth, mapHeight, bitmaps,
  }
  );

  const levels = transformLevelConfiguration(geomOptions.elevationLevels, geomOptions.normalizeLevels);

  const { creepGrpSD, palette, hdTiles, creepGrpHD, tilegroupU16, tileset, megatiles, minitiles } = tilesetBuffers;

  log.verbose(`Generating terrain ${settings.textureResolution} textures`);

  const renderer = renderComposer.getWebGLRenderer();

  const displacementImages = await dataTexturesToHeightMaps({
    palette,
    tileset,
    mapWidth,
    mapHeight,
    dataTextures,
    geomOptions,
    levels,
    renderer
  });

  const isLowRes = settings.textureResolution === UnitTileScale.SD;

  renderer.autoClear = false;
  renderer.outputEncoding = LinearEncoding;
  renderer.clear();
  const creepTexture = isLowRes ? sd.grpToCreepTexture(palette, megatiles, minitiles, tilegroupU16) : hd.ddsToCreepTexture(hdTiles, tilegroupU16, settings.textureResolution, renderer);

  renderer.clear();
  const creepEdgesTexture = isLowRes ? await sd.grpToCreepEdgesTextureAsync(creepGrpSD, palette) : hd.ddsToCreepEdgesTexture(creepGrpHD, settings.textureResolution, renderer);

  renderer.clear();
  const textures = isLowRes ? sd.createSdQuartiles(mapWidth, mapHeight, bitmaps.diffuse) : hd.createHdQuartiles(mapWidth, mapHeight,
    hdTiles,
    bitmaps.mapTilesData,
    settings.textureResolution, renderer
  );

  {
    const waterNormal1 = parseDdsGrpAsTextures(tilesetBuffers.waterNormal1);
    const waterNormal2 = parseDdsGrpAsTextures(tilesetBuffers.waterNormal2);
    const noise = await parseDDS(tilesetBuffers.noise, false);
    const waterMask = parseDdsGrpAsTextures(tilesetBuffers.waterMask);
    const tileMask = parseTMSK(tilesetBuffers.tileMask);

  }

  renderer.autoClear = true;
  renderer.outputEncoding = sRGBEncoding;

  const terrain = await createTerrainGeometryFromQuartiles(mapWidth, mapHeight, creepTexture, creepEdgesTexture, geomOptions, dataTextures, displacementImages.displaceCanvas, textures);
  terrain.layers.enable(Layers.Terrain);

  const minimapBitmap = await sd.createMinimapBitmap(bitmaps.diffuse, mapWidth, mapHeight);

  const getTerrainY = genTerrainY(
    displacementImages.displacementImage,
    geomOptions.maxTerrainHeight,
    mapWidth,
    mapHeight
  );

  let _shadows = settings.shadows;
  let _anisotropy = settings.anisotropy;

  return {
    terrain: {
      mesh: terrain,
      getTerrainY,
      geomOptions,
      get shadowsEnabled() {
        return _shadows;
      },
      set shadowsEnabled(val: boolean) {
        _shadows = val;
        terrain.traverse(o => {
          if (o instanceof Mesh) {
            o.castShadow = val;
            o.receiveShadow = val;
          }
        });
      },
      get anisotropy() {
        return _anisotropy;
      },
      set anisotropy(anisotropy: string) {
        _anisotropy = anisotropy;
        const value = anisotropyOptions[anisotropy as keyof typeof anisotropyOptions];
        creepTexture.texture.anisotropy = value;

        creepEdgesTexture.texture.anisotropy = value;

        for (const row of textures.mapQuartiles) {
          for (const texture of row) {
            texture.anisotropy = value;
          }
        }
      }
    },
    extra: {
      minimapBitmap,
      creepEdgesTextureUniform: dataTextures.creepEdgesTextureUniform,
      creepTextureUniform: dataTextures.creepTextureUniform,
    }
  }
}
