import { ReadFile } from "common/types";
import type OpenBWFileList from "../../renderer/openbw/openbw-filelist";
import { EmscriptenPreamble } from "./emscripten";
import { SoundStruct } from "./structs";

type Callbacks = {
    js_fatal_error?: ( ptr: number ) => string;
    js_pre_main_loop?: () => void;
    js_post_main_loop?: () => void;
    js_file_size?: ( index: number ) => number;
    js_read_data?: ( index: number, dst: number, offset: number, size: number ) => void;
    js_load_done?: () => void;
    js_file_index?: ( ptr: number ) => number;
};

export interface OpenBWWasm extends EmscriptenPreamble {
    _reset: () => void;
    _load_replay: ( buffer: number, length: number ) => void;
    _load_map: ( buffer: number, length: number ) => void;
    _upload_height_map: (
        buffer: number,
        length: number,
        width: number,
        height: number
    ) => void;
    _load_replay_with_height_map: (
        replayBuffer: number,
        replayLength: number,
        buffer: number,
        length: number,
        width: number,
        height: number
    ) => void;

    _next_frame: () => number;
    _next_no_replay: () => number;
    _create_unit: ( unitId: number, playerId: number, x: number, y: number ) => number;

    _counts: ( index: number ) => number;
    _get_buffer: ( index: number ) => number;

    _replay_get_value: ( index: number ) => number;
    _replay_set_value: ( index: number, value: number ) => void;

    _set_player_visibility: ( playerId: number ) => void;

    _generate_frame: () => void;

    get_util_funcs: () => {
        get_sounds: () => SoundStruct[];
        dump_unit: ( unitAddr: number ) => {
            id: number;
            resourceAmount?: number;
            remainingTrainTime?: number;
            upgrade?: {
                id: number;
                level: number;
                time: number;
            };
            research?: {
                id: number;
                time: number;
            };
            loaded?: number[];
            buildQueue?: number[];
        };
        kill_unit: ( unitId: number ) => number;
        remove_unit: ( unitId: number ) => number;
        issue_command: (
            unitId: number,
            command: number,
            targetId: number,
            x: number,
            y: number,
            extra: number
        ) => boolean;
    };
    callMain: () => void;
    getExceptionMessage: ( e: unknown ) => string;

    setupCallbacks: ( callbacks: Callbacks ) => void;
}

export interface OpenBW extends OpenBWWasm {
    running: boolean;
    files: OpenBWFileList;

    unitGenerationSize: number;

    isSandboxMode: () => boolean;
    setSandboxMode: ( mode: boolean ) => boolean | undefined;

    // updates frame and creep data
    generateFrame: () => void;

    getFowSize: () => number;
    getFowPtr: () => number;
    setPlayerVisibility: ( visibility: number ) => void;

    getCreepSize: () => number;
    getCreepPtr: () => number;

    getCreepEdgesSize: () => number;
    getCreepEdgesPtr: () => number;

    getTilesPtr: () => number;
    getTilesSize: () => number;

    getSoundObjects: () => SoundStruct[];

    getLastError: () => number;
    getLastErrorMessage: () => string | null;

    getSpritesOnTileLineSize: () => number;
    getSpritesOnTileLineAddress: () => number;

    getPlayersAddress: () => number;

    getUnitsAddr: () => number;

    getBulletsAddress: () => number;
    getBulletsDeletedCount: () => number;
    getBulletsDeletedAddress: () => number;

    getSoundsAddress: () => number;
    getSoundsCount: () => number;

    setGameSpeed: ( speed: number ) => void;
    getGameSpeed: () => number;

    setCurrentFrame: ( frame: number ) => void;
    getCurrentFrame: () => number;

    getIScriptProgramDataSize: () => number;
    getIScriptProgramDataAddress: () => number;

    isPaused: () => boolean;
    setPaused: ( paused: boolean ) => void;

    isReplay: () => boolean;
    nextFrame: () => number;
    nextFrameNoAdvance: () => number;
    tryCatch: <T>( callback: () => T ) => T;
    loadReplay: ( buffer: Buffer ) => void;
    loadMap: ( buffer: Buffer ) => void;
    start: ( readFile: ReadFile ) => Promise<void>;

    uploadHeightMap: ( data: Uint8ClampedArray, width: number, height: number ) => void;
    loadReplayWithHeightMap: (
        replayBuffer: Buffer,
        data: Uint8ClampedArray,
        width: number,
        height: number
    ) => void;

    setUnitLimits: ( unitLimits: number ) => void;
}
