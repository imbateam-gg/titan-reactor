import filepaths from "./filepaths";
import * as log from "../ipc/log";

interface Callbacks {
  beforeFrame: () => void;
  afterFrame: () => void;
}

// A wrapper around file buffers that openbw wasm needs
export default class OpenBWFileList {
  private buffers: Int8Array[] = [];
  private index: Record<string, number> = {};
  unused: number[] = [];
  private _cleared = false;

  normalize(path: string) {
    return path.toLowerCase().replace(/\//g, "\\");
  }

  init(openBw: any, callbacks: Callbacks) {
    openBw.setupCallbacks(
      (ptr: any) => {
        throw new Error(openBw.UTF8ToString(ptr));
      },
      callbacks.beforeFrame, // pre-mainloop
      callbacks.afterFrame, // post-mainloop,
      (index: number) => {
        return this.buffers[index].byteLength; // get file size: ;
      },
      (index: number, dst: number, offset:number, size:number) =>  { // get file buffer
        var data = this.buffers[index];
        for (var i2 = 0; i2 != size; ++i2) {
          openBw.HEAP8[dst + i2] = data[offset + i2];
        }
      }, 
      () => {
        this.clear(); // done loading, openbw has its own memory now
        log.verbose("openbw complete loading");
        log.verbose(`${this.unused.length} unused assets`);
      },
      (ptr: any) => {
        const filepath = openBw.UTF8ToString(ptr);
        if (filepath === undefined) {
          throw new Error("Filename is undefined");
        }
        const index = this.index[this.normalize(filepath)];
        this.unused.splice(this.unused.indexOf(index), 1);
        log.verbose(`pulling ${this.normalize(filepath)} ${index}`);
        return index >= 0 ? index : 9999;
      }
    );
  }

  async loadBuffers(readFile: (filename: string) => Promise<Buffer>) {
    if (this._cleared) {
      throw new Error("File list already cleared");
    }

    for (const filepath of filepaths) {
      const buffer = await readFile(filepath);

      const int8 = new Int8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.length
      )

      this.buffers.push(int8);
      log.verbose(
        `pushing ${this.normalize(filepath)} ${this.buffers.length - 1} ${int8.byteLength}`
      );
      this.index[this.normalize(filepath)] = this.buffers.length - 1;
      this.unused.push(this.buffers.length - 1);
    }

    // const paths = [];
    // for ( const filename of filelist ) {
    //   console.log(`Loading ${filename}`);
    //   const path = await findFile(filename);
    //   if (!path) {
    //     throw new Error(`File not found: ${filename}`);
    //   }
    //   paths.push(path);
    //   // const buffer = await readFile(path);
    //   // this.files.push(buffer);
    //   // this.index[filename.toLowerCase()] = this.files.length-1;
    // }
    // fs.writeFileSync("filelist.json", ["export default", JSON.stringify(paths)].join(" "));
  }

  clear() {
    this.buffers = [];
    this._cleared = true;
  }
}
