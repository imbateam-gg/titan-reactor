import { AnimationClip, BufferGeometry, CompressedTexture, Group, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh, Texture } from "three";
import { UnitTileScale } from "./image";

export type AnimFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  xoff: number;
  yoff: number;
};

export type GrpSprite = {
  w: number;
  h: number;
  frames: AnimFrame[];
  maxFrameH: number;
  maxFramew: number;
};

type HDLayers = {
  brightness?: CompressedTexture | undefined;
  normal?: CompressedTexture | undefined;
  specular?: CompressedTexture | undefined;
  aoDepth?: CompressedTexture | undefined;
  emissive?: CompressedTexture | undefined;
}

export interface Atlas {
  textureWidth: number;
  textureHeight: number;
  spriteWidth: number;
  spriteHeight: number;
  imageIndex: number;
  frames: AnimFrame[];
  diffuse: Texture;
  teammask?: Texture;
  unitTileScale: UnitTileScale;
  grp: GrpSprite;

  hdLayers?: HDLayers;
  mipmap?: HDLayers;
};

export interface GltfAtlas extends Atlas {
  model: Object3D; //Mesh<BufferGeometry, MeshStandardMaterial> | SkinnedMesh<BufferGeometry, MeshStandardMaterial>;
  animations: AnimationClip[];
  fixedFrames: number[];
}

export type AnimDds = {
  ddsOffset: number;
  size: number;
  width: number;
  height: number;
};

export type AnimSpriteRef = {
  refId: number;
};

export type DDSGrpFrameType = {
  i: number;
  w: number;
  h: number;
  size: number;
  dds: Buffer;
};
