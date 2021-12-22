import { Group } from "three";

import {
  drawFunctions,
  imageTypes,
  iscriptHeaders,
  overlayTypes,
} from "../bwdat/enums";
import { BwDAT, ImageDAT, UnitDAT } from "../types";
import pick from "../utils/pick";
import { ImageInstance } from "./image-instance";
import TitanImage3D from "./titan-image-3d";

enum ImageOrder {
  bottom,
  top,
  above,
  below,
}

export class TitanSprite extends Group {
  private bwDat: BwDAT;
  images: ImageInstance[];
  mainImage?: ImageInstance;
  logger: { log: (str: string) => void };
  lastZOff: number;
  unit: any | null;
  createTitanSprite: (unit: UnitDAT | null | undefined) => TitanSprite;
  createTitanSpriteCb: (titanSprite: TitanSprite) => void;
  destroyTitanSpriteCb: (titanSprite: TitanSprite) => void;

  //@todo merge this with other createTitanImage that takes SpriteInstance
  createTitanImage: (
    image: number,
    parent: TitanSprite
  ) => ImageInstance | null;

  iscriptOptions: {
    createBullets: boolean;
    moveUnit: boolean;
  };

  constructor(
    unit: any = null,
    bwDat: BwDAT,
    createTitanSprite: (unit: UnitDAT | null) => TitanSprite,
    createTitanImage: (
      image: number,
      parent: TitanSprite
    ) => ImageInstance | null,
    createTitanSpriteCb: (titanSprite: TitanSprite) => void,
    destroyTitanSpriteCb: (titanSprite: TitanSprite) => void = () => {},
    logger = { log: () => {} }
  ) {
    super();
    this.unit = unit;
    this.bwDat = bwDat;
    this.images = [];
    this.createTitanSprite = createTitanSprite;
    this.createTitanSpriteCb = createTitanSpriteCb;
    this.destroyTitanSpriteCb = destroyTitanSpriteCb;
    this.createTitanImage = createTitanImage;
    this.iscriptOptions = {
      createBullets: false,
      moveUnit: false,
    };
    this.logger = logger;
    this.renderOrder = 4;
    this.lastZOff = 0;
  }

  addImage(image: number, imageOrder?: ImageOrder, rel?: number) {
    const relImage =
      rel === undefined
        ? this.images.indexOf(this.mainImage as ImageInstance)
        : rel;
    let pos = relImage;

    switch (imageOrder) {
      case ImageOrder.below:
        {
          pos = relImage - 1;
        }
        break;
      case ImageOrder.bottom:
        {
          pos = 0;
        }
        break;
      case ImageOrder.top:
        {
          pos = this.images.length - 1;
        }
        break;
    }

    const titanImage = this.createTitanImage(image, this);
    if (!titanImage) {
      return null;
    }
    if (titanImage.imageDef.drawFunction === drawFunctions.rleShadow) {
      return null;
    }
    this.add(titanImage);
    titanImage.iscript.logger = this.logger;
    titanImage.iscript.run(iscriptHeaders.init);
    if (this.images.length === 0) {
      this.mainImage = titanImage;
      this.images.push(titanImage);
    } else {
      this.images.splice(pos, 0, titanImage);
    }
    this._update(titanImage);
    return titanImage;
  }

  //it might be that we dont want to change frame if sprite is not on a frameset
  setDirection(direction: number) {
    if (direction === this.direction) return;
    this.mainImage?.iscript.setDirection(direction);
    this.mainImage?.setFrame(
      this.mainImage.userData.frame,
      this.mainImage.userData.flip
    );
  }

  //iscript_execute_sprite
  update(delta: number, cameraDirection: number) {
    // if (this.unit) {
    //   this.position.copy(this.unit.position);
    //   this.rotation.copy(this.unit.rotation);
    //   this.setDirection((this.unit.direction + cameraDirection) % 32);
    //   this.visible = this.unit.visible;

    //   if (
    //     this.unit.current.anim !== this.unit.previous.anim &&
    //     headersById[this.unit.current.anim]
    //   ) {
    //     this.run(this.unit.current.anim);
    //   }
    // }

    let _terminated = false;
    for (const image of this.images) {
      if (image instanceof TitanImage3D && image.mixer) {
        image.mixer.update(0); //3d animation mixer
      }
      this._update(image);
      if (image.userData.terminated) {
        _terminated = true;
        this.remove(image);
      }
    }

    if (_terminated) {
      this.images = this.images.filter((image) => !image.userData.terminated);
      if (!this.images.find((i) => i === this.mainImage)) {
        this.mainImage = this.images[this.images.length - 1];
      }
      if (this.images.length === 0) {
        this.destroyTitanSpriteCb(this);
      }
    }

    const nextZOff = this.mainImage
      ? (this.mainImage?._zOff * this.mainImage?._spriteScale) / 32
      : 0;
    this.position.z = this.position.z - this.lastZOff + nextZOff;
    this.lastZOff = nextZOff;

    return this.images.length;
  }

  _update(image: ImageInstance) {
    //image modifier == 2 || 5 update cloak
    // 4o r 7 -> decloak
    //17 ? warpin
    //destroyed? iscript exec returns false
    //if destroyed main image, set main image to front most image
    //if no more images terminate this sprite

    const dispatched = image.iscript.update();
    for (const [key, val] of dispatched) {
      switch (key) {
        case "playfram":
          {
            image.setFrame(val[0], val[1]);
          }
          break;
        case "imgol":
          {
            const [imageId, x, y] = val;

            const titanImage = this.addImage(imageId, ImageOrder.above);
            if (!titanImage) break;
            titanImage.setPosition(x, y);
          }
          break;
        case "imgul":
          {
            const [imageId, x, y] = val;

            const titanImage = this.addImage(imageId, ImageOrder.below);
            if (!titanImage) break;
            titanImage.setPosition(x, -y);
          }
          break;
        case "imgolorig":
          {
            /* 
            if (!i_flag(new_image, image_t::flag_uses_special_offset))
						{
							i_set_flag(new_image, image_t::flag_uses_special_offset);
							update_image_special_offset(new_image);
            }
            */
            const [imageId] = val;
            //get_image_lo_offset(image->sprite->main_image, 2, 0)
            const titanImage = this.addImage(imageId, ImageOrder.above);
            if (!titanImage) break;
            const [ox, oy] = this._getImageLoOffset(
              this.mainImage,
              overlayTypes.specialOverlay,
              0
            );
            titanImage.setPosition(ox, oy, 32);
          }
          break;
        case "imgoluselo":
          {
            const [imageId, x, y] = val;

            const titanImage = this.addImage(imageId, ImageOrder.above);
            if (!titanImage) break;
            const ox = titanImage.image.los[x];
            const oy = titanImage.image.los[y];
            titanImage.setPosition(ox, oy, 32);
          }
          break;
        case "imguluselo":
          {
            const [imageId, x, y] = val;

            const titanImage = this.addImage(imageId, ImageOrder.below);
            if (!titanImage) break;
            const ox = titanImage.image.los[x];
            const oy = titanImage.image.los[y];
            titanImage.setPosition(ox, oy, 32);
          }
          break;
        case "imgulnextid":
          {
            const [x, y] = val;
            const titanImage = this.addImage(
              image.imageDef.index + 1,
              ImageOrder.below
            );
            if (!titanImage) break;
            titanImage.setPosition(x, y, 32);
          }
          break;

        case "sprol":
          {
            const [spriteId, x, y] = val;

            // @todo
            // if is bullet && parent->goliath && charonboosted
            // change spriteId to halo rockets trail

            const titanSprite = this.createTitanSprite();
            titanSprite.addImage(this.bwDat.sprites[spriteId].image.index);
            titanSprite.run(iscriptHeaders.init);

            //@todo ensure main image otherwise the sprite is dead
            titanSprite.mainImage?.setPosition(x, y);
            titanSprite.position.copy(this.position);
            this.createTitanSpriteCb(titanSprite);
          }
          break;
        case "sprul":
          {
            //<sprite#> <x> <y> - spawns a sprite one animation level below the current image overlay at a specific offset position. The new sprite inherits the direction of the current sprite.

            const [spriteId, x, y] = val;

            /* 
            @todo
            "if unit and is cloaked and not always visible dont spawn"
            if (iscript_unit && (u_requires_detector(iscript_unit) || u_cloaked(iscript_unit)) && !sprite->image->always_visible)
            break;
            */

            const titanSprite = this.createTitanSprite();
            titanSprite.addImage(this.bwDat.sprites[spriteId].image.index);
            titanSprite.setDirection(this.direction);
            titanSprite.run(iscriptHeaders.init);

            titanSprite.mainImage?.setPosition(x, y);
            titanSprite.position.copy(this.position);
            this.createTitanSpriteCb(titanSprite);
          }
          break;
        case "lowsprul":
          {
            //@todo check if we set direction
            //<sprite#> <x> <y> - spawns a sprite at the lowest animation level at a specific offset position.
            // sprites.push([...val, 1]);
            const [spriteId, x, y] = val;

            //@todo elevation 1
            const titanSprite = this.createTitanSprite();
            titanSprite.addImage(this.bwDat.sprites[spriteId].image.index);
            titanSprite.run(iscriptHeaders.init);

            titanSprite.mainImage?.setPosition(x, y);
            titanSprite.position.copy(this.position);
            this.createTitanSpriteCb(titanSprite);
            // console.log("lowsprul", [x, y]);
          }
          break;
        case "highsprol":
          {
            //<sprite#> <x> <y> - spawns a sprite at the highest animation level at a specific offset position.
            const [spriteId, x, y] = val;

            const titanSprite = this.createTitanSprite();
            titanSprite.addImage(this.bwDat.sprites[spriteId].image.index);
            titanSprite.run(iscriptHeaders.init);

            titanSprite.mainImage?.setPosition(x, y);
            titanSprite.position.copy(this.position);
            this.createTitanSpriteCb(titanSprite);
          }
          break;
        case "sproluselo":
          {
            const [spriteId, overlay] = val;
            // <sprite#> <overlay#> - spawns a sprite one animation level above the current image overlay, using a specified LO* file for the offset position information. The new sprite inherits the direction of the current sprite.

            //@todo this.userData.elevation + 1
            const titanSprite = this.createTitanSprite();
            titanSprite.addImage(this.bwDat.sprites[spriteId].image.index);
            // titanSprite.run(0);
            titanSprite.setDirection(this.direction);
            const [ox, oy] = this._getImageLoOffset(image, overlay, 0);

            titanSprite.mainImage?.setPosition(ox, oy);
            titanSprite.run(iscriptHeaders.init);

            titanSprite.position.copy(this.position);
            this.createTitanSpriteCb(titanSprite);

            // console.log("sproluselo", [ox, oy, image.userData.frame]);
          }
          break;
        case "spruluselo":
          {
            //<sprite#> <x> <y> - spawns a sprite one animation level below the current image overlay at a specific offset position. The new sprite inherits the direction of the current sprite. Requires LO* file for unknown reason.
            /*
            if (iscript_unit && (u_requires_detector(iscript_unit) || u_cloaked(iscript_unit)) && !sprite->image->always_visible)
              break;
              */
            //set direction
            // sprites.push([...val, this.userData.elevation]);
          }
          break;
        case "sethorpos":
          {
            const [x] = val;
            image.setPositionX(x);
          }
          break;
        case "setvertpos":
          {
            const [y] = val;

            //mostly for flyer hover effect

            // if (!iscript_unit || (!u_requires_detector(iscript_unit) && !u_cloaked(iscript_unit)))
            //
            image.setPositionY(y);
          }
          break;
        case "creategasoverlays":
          {
            const imageOffset = val[0];
            const imageId = imageTypes.gasOverlay;
            //@todo support imageTypes.depletedGasOverlay;

            const titanImage = this.addImage(
              imageId + imageOffset,
              ImageOrder.above
            );
            if (!titanImage) break;

            const los = this.bwDat.los[image.imageDef.specialOverlay - 1];
            const [ox, oy] = los[titanImage.userData.frame][imageOffset];

            titanImage.position.x = ox / 32;
            titanImage.position.z = oy / 32;
          }
          break;
        // case "useweapon":
        //   {
        //   }
        //   break;
        // case "attackwith":
        //   {
        //   }
        //   break;
        // case "attack":
        //   {
        //   }
        //   break;
        // case "domissiledmg":
        //   {
        //   }
        //   break;
        // case "dogrddamage":
        //   {
        //   }
        //   break;
        // case "dogrddamage":
        //   {
        //   }
        //   break;
        // case "castspell":
        //   {
        //   }
        //   break;
        // case "attkshiftproj":
        //   {
        //   }
        //   break;
        // case "trgtrangecondjmp":
        //   {
        //   }
        //   break;
        // case "trgtarccondjmp":
        //   {
        //   }
        //   break;
        // case "curdirectcondjmp":
        //   {
        //   }
        //   break;

        // case "grdsprol":
        //   {
        //   }
        //   break;
        // case "warpoverlay":
        //   {
        //   }
        //   break;

        case "setpos":
          {
            const [x, y] = val;

            image.setPosition(x, y);
          }
          break;

        case "end":
          {
            //@todo allow_main_image_destruction
            image.userData.terminated = true;
          }
          break;
        case "followmaingraphic":
          {
            if (this.mainImage) {
              Object.assign(
                image.userData,
                pick(["frame", "flip"], this.mainImage.userData)
              );
              image.setFrame(image.userData.frame, image.userData.flip);
            }
          }
          break;
        case "setflipstate":
          {
            /*
            if (i_flag(image, image_t::flag_horizontally_flipped) != (a != 0))
					{
						i_set_flag(image, image_t::flag_horizontally_flipped, a != 0);
						set_image_modifier(image, image->modifier);
						if (image->flags & image_t::flag_uses_special_offset)
							update_image_special_offset(image);
					}*/
          }
          break;

        case "engframe":
          {
            image.setFrame(val[0], val[1]);
            //corsair, scout, wraith
            //engframe - <frame#> - plays a particular frame, often used in engine glow animations.
          }
          break;
        case "engset":
          {
            image.setFrame(val[0], val[1]);
            //arbiter, bc, scv, valk
            //engset - <frameset#> - plays a particular frame set, often used in engine glow animations.
          }
          break;
        case "tmprmgraphicstart":
          {
            image.visible = false;
          }
          break;
        case "tmprmgraphicend":
          {
            image.visible = true;
          }
          break;
        default:
          break;
      }
    }
  }

  _getImageLoOffset(
    image: ImageInstance,
    overlay: number,
    imageOffset: number,
    useFrameset = false
  ) {
    const frame = useFrameset ? image.userData.frameset : image.userData.frame;

    const overlayKey = overlayTypes[overlay - 1] as keyof ImageDAT;
    const losIndex = image.imageDef[overlayKey] as number;
    const los = this.bwDat.los[losIndex];
    if (!los || los.length == 0) {
      throw new Error("no los here");
    }
    const [x, y] = los[frame][imageOffset];

    if (image.userData.flip) {
      return [-x, y];
    } else {
      return [x, y];
    }
  }

  run(header: number) {
    for (const image of this.images) {
      image.iscript.run(header);
    }
  }

  get direction() {
    return this.mainImage?.userData.direction;
  }

  dispose() {}
}
export default TitanSprite;
