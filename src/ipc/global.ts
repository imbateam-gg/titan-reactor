import { UI_SYSTEM_OPEN_URL } from "@plugins/events";
import { withErrorMessage } from "common/utils/with-error-message";

import { settingsStore, useSettingsStore } from "@stores/settings-store";
import { Janitor, JanitorLogLevel } from "three-janitor";
import { globalEventKeys, GlobalEvents, globalEvents } from "../core/global-events";
import { log } from "@ipc/log";
import { openFile } from "./files";

window.addEventListener(
    "message",
    ( evt: { data: { type?: string; payload?: string } } ) =>
        evt.data.type === UI_SYSTEM_OPEN_URL &&
        globalEvents.emit( "unsafe-open-url", evt.data.payload )
);

// Load Replay File ( Drag and Drop )

document.addEventListener( "dragover", ( e ) => {
    e.preventDefault();
    e.stopPropagation();
} );

document.addEventListener( "drop", async ( event ) => {
    event.preventDefault();
    event.stopPropagation();

    if ( event.dataTransfer && event.dataTransfer.files.length ) {
        const files = [];
        for ( const file of event.dataTransfer.files ) {
            files.push({
                name: file.name,
                buffer: await openFile(file),
            })
        }
        globalEvents.emit( "queue-files", {
            files,
        } );
    }
} );

window.onerror = (
    _: Event | string,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
) => {
    log.error(withErrorMessage( error, `${lineno!}:${colno!} - ${source!}` ));
};

document.addEventListener(
    "visibilitychange",
    () => globalEvents.emit( "document-hidden", document.hidden ),
    false
);

type ConfigMessage = {
    type: keyof GlobalEvents;
    payload: any;
};

// receive global events from configuration ui
window.addEventListener( "message", function ( event: MessageEvent<ConfigMessage> ) {
    if ( globalEventKeys.includes( event.data.type ) ) {
        // eslint-disable-next-line
        globalEvents.emit(event.data.type, event.data.payload);
    }
} );

export const getJanitorLogLevel = () => {
    switch ( settingsStore().data.utilities.logLevel ) {
        case "debug":
            return JanitorLogLevel.Debug;
        case "warn":
        case "error":
            return JanitorLogLevel.Info;
    }

    return JanitorLogLevel.None;
};

window.addEventListener( "keydown", ( event ) => {
    event.code === "KeyP" && event.ctrlKey && globalEvents.emit( "reload-all-plugins" );
} );

useSettingsStore.subscribe( () => {
    Janitor.logLevel = getJanitorLogLevel();
} );

// ipcRenderer.on( OPEN_ISCRIPTAH, () => globalEvents.emit( "load-iscriptah" ) );
