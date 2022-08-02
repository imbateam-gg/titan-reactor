import * as THREE from "three";
import { blendNonZeroPixels } from "../rgb";
import { MapBitmaps } from "./extract-bitmaps";

export interface MapDataTextures {
    sdMap: THREE.DataTexture,
    occlussionRoughnessMetallicMap: THREE.DataTexture,
    mapTilesMap: THREE.DataTexture,
    creepTextureUniform: {
        value: THREE.DataTexture,
    },
    creepEdgesTextureUniform: {
        value: THREE.DataTexture,
    },
    displacementDetailsMap: THREE.DataTexture,
    elevationsMap: THREE.DataTexture,
    nonZeroElevationsMap: THREE.DataTexture,
    paletteIndicesMap: THREE.DataTexture,
    paletteMap: THREE.DataTexture,
}

const _defaultOpts = {
    encoding: THREE.LinearEncoding,
    format: THREE.RGBAFormat,
    textureDataType: THREE.UnsignedByteType,
    flipY: true
}
type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

const createNonZeroElevationsData = (layers: Uint8Array, width: number, height: number, blendNonWalkableBase: boolean) => {
    const nonZeroLayers = layers.slice(0);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const pos = y * width + x;
            if ([0, 2, 4].includes(nonZeroLayers[pos])) {
                nonZeroLayers[pos] = 0;
            }
        }
    }

    if (blendNonWalkableBase) {
        blendNonZeroPixels(nonZeroLayers, width, height);
    }
    return nonZeroLayers;
}

const createDataTexture = (data: ArrayBuffer, width: number, height: number, userOpts?: Overwrite<Partial<typeof _defaultOpts>, { internalFormat?: THREE.PixelFormatGPU | null }>) => {
    const opts = Object.assign({}, _defaultOpts, userOpts);

    const tex = new THREE.DataTexture(
        data,
        width,
        height,
        opts.format,
        opts.textureDataType
    );
    tex.flipY = opts.flipY;
    tex.needsUpdate = true;
    tex.encoding = opts.encoding;
    if (opts.internalFormat) {
        tex.internalFormat = opts.internalFormat;
    }
    return tex;
}

export const createDataTextures = async ({
    blendNonWalkableBase,
    palette,
    mapWidth,
    mapHeight,
    bitmaps,

}:
    {
        blendNonWalkableBase: boolean,
        palette: Uint8Array,
        mapWidth: number,
        mapHeight: number,
        bitmaps: MapBitmaps,
    }
): Promise<MapDataTextures> => {

    const w32 = mapWidth * 32;
    const h32 = mapHeight * 32;

    // minitile resolution
    const w4 = mapWidth * 4;
    const h4 = mapHeight * 4;

    const sdMap = createDataTexture(bitmaps.diffuse, w32, h32, { encoding: THREE.sRGBEncoding });
    const occlussionRoughnessMetallicMap = createDataTexture(bitmaps.occlussionRoughnessMetallic, w32, h32, { format: THREE.RGBAFormat });
    const mapTilesMap = createDataTexture(bitmaps.mapTilesData, mapWidth, mapHeight, { format: THREE.RedIntegerFormat, textureDataType: THREE.UnsignedShortType, internalFormat: "R16UI" });

    const creepEdgesValues = createDataTexture(new Uint8Array(mapWidth * mapHeight), mapWidth, mapHeight, { format: THREE.RedFormat });
    const creepValues = createDataTexture(new Uint8Array(mapWidth * mapHeight), mapWidth, mapHeight, { format: THREE.RedFormat });

    const displacementDetailsMap = createDataTexture(bitmaps.displacementDetail, w32, h32, { format: THREE.RedIntegerFormat, internalFormat: "R8UI" });
    const elevationsMap = createDataTexture(bitmaps.layers, w4, h4, { format: THREE.RedIntegerFormat, internalFormat: "R8UI" });
    const nonZeroElevationsMap = createDataTexture(createNonZeroElevationsData(bitmaps.layers, w4, h4, blendNonWalkableBase), w4, h4, { format: THREE.RedIntegerFormat, internalFormat: "R8UI" });

    const paletteIndicesMap = createDataTexture(bitmaps.paletteIndices, w32, h32, { format: THREE.RedIntegerFormat, internalFormat: "R8UI" });
    const paletteMap = createDataTexture(new Float32Array(palette.length).fill(0).map((_, i) => palette[i] / 255), palette.length / 4, 1, { textureDataType: THREE.FloatType, flipY: false, encoding: THREE.sRGBEncoding });

    return {
        sdMap,
        occlussionRoughnessMetallicMap,
        mapTilesMap,
        creepTextureUniform: { value: creepValues },
        creepEdgesTextureUniform: { value: creepEdgesValues },
        displacementDetailsMap,
        elevationsMap,
        nonZeroElevationsMap,
        paletteIndicesMap,
        paletteMap,
    };
};
export default createDataTextures;
