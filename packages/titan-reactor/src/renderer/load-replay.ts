
import {
    sidegradeReplay,
    parseReplay,
    Version,
    CommandsStream,
    ChkDowngrader,
} from "downgrade-replay";
import fs from "fs";
import path from "path";

import Chk from "bw-chk";
import {
    createImageFactory,
    ImageHD
} from "./core";
import { createIScriptRunnerFactory } from "../common/iscript";
import { EmptyFunc } from "../common/types";
import uniq from "../common/utils/uniq";
import { AudioMaster } from "./audio";
import OpenBwBridgeReader from "./integration/fixed-data/readers/openbw-bridge-reader";
import { log, openFile } from "./ipc";
import { Scene } from "./render";
import { generateTerrain } from "./assets/generate-terrain";
import {
    disposeGame,
    getAssets,
    getSettings,
    setGame,
    startLoadingProcess,
    updateIndeterminateLoadingProcess,
    completeLoadingProcess,
    initScreen,
    updateScreen,
    completeScreen,
    ReplayScreen,
} from "./stores";
import TitanReactorGame from "./view-replay";
import { BwDAT } from "../common/types";
import getFunString from "./bootup/get-fun-string";
import waitForAssets from "./bootup/wait-for-assets";

export default async (filepath: string) => {
    log(`loading replay ${filepath}`);


    startLoadingProcess({
        id: "replay",
        label: getFunString(),
        priority: 1,
    });

    disposeGame();

    const settings = getSettings();

    // validate before showing any loading progress
    const repBin = await openFile(filepath);
    let rep = await parseReplay(repBin);

    document.title = "Titan Reactor - Loading";

    initScreen({
        type: "replay",
        filename: filepath,
    } as ReplayScreen);

    log("parsing replay");
    let repFile = filepath;
    const outFile = path.join(settings.tempPath, "replay.out");

    updateScreen({ header: rep.header } as ReplayScreen);

    if (rep.version !== Version.titanReactor) {
        const chkDowngrader = new ChkDowngrader();
        const newrep = await sidegradeReplay(rep, chkDowngrader);
        repFile = path.join(settings.tempPath, "replay.rep");
        //@todo use fsPromises, bail on error
        await new Promise((res: EmptyFunc) =>
            fs.writeFile(repFile, newrep, (err) => {
                if (err) {
                    log(err.message, "error");
                    return;
                }
                res();
            })
        );
        rep = await parseReplay(newrep);
    }

    log("loading chk");
    const chk = new Chk(rep.chk);
    updateScreen({ chkTitle: chk.title } as ReplayScreen);

    log("building terrain");
    const terrainInfo = await generateTerrain(chk);
    const scene = new Scene(terrainInfo);

    await waitForAssets();

    updateIndeterminateLoadingProcess("replay", "Connecting to the hivemind");

    log(`starting gamestate reader ${repFile} ${outFile}`);
    const gameStateReader = new OpenBwBridgeReader(
        settings.starcraftPath,
        repFile,
        outFile
    );
    await gameStateReader.start();
    log("waiting for maxed");

    await gameStateReader.waitForMaxed;

    const races = settings.musicAllTypes
        ? ["terran", "zerg", "protoss"]
        : uniq(rep.header.players.map(({ race }: { race: string }) => race)) as string[];

    const assets = getAssets();
    if (!assets || !assets.bwDat) {
        throw new Error("assets not loaded");
    }
    log("initializing audio");
    const audioMaster = new AudioMaster(
        assets.loadAudioFile.bind(assets),
        races
    );
    audioMaster.musicVolume = settings.musicVolume;
    audioMaster.soundVolume = settings.soundVolume;

    log("initializing replay");
    updateIndeterminateLoadingProcess("replay", getFunString());
    ImageHD.useDepth = false;
    const game = await TitanReactorGame(
        scene,
        terrainInfo,
        chk.units,
        rep,
        new CommandsStream(rep.rawCmds),
        gameStateReader,
        assets.bwDat,
        audioMaster
    );

    setGame(game);
    completeScreen();

    log("starting replay");
    document.title = "Titan Reactor - Observing";
    game.start();
    completeLoadingProcess("replay");
};