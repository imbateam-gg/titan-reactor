import create from "zustand";
import { log } from "@ipc/log";
import { MathUtils } from "three";

const PROCESS_MAX = 10;

export interface IncrementalProcess {
    id: string;
    label: string;
    max: number;
    current: number;
}

export interface ProcessProgressWrapper {
    id: string;
    increment: () => void;
    add( additiona: number ): void;
    complete(): void;
}

export interface ProcessStore {
    processes: IncrementalProcess[];
    create: ( label: string, max: number ) => ProcessProgressWrapper;
    increment: ( id: string, current?: number ) => void;
    complete( id: string ): void;
    isComplete: ( id: string ) => boolean;
    isInProgress: ( id: string ) => boolean;
    inProgress: () => IncrementalProcess[];
    getTotalProgress: () => number;
    clearCompleted: () => void;
    clearAll: () => void;
    _createProcessWrapper: ( id: string, process: IncrementalProcess ) => ProcessProgressWrapper;
}

/**
 * Loading processes store. Used to track progress of loading and displaying it to the user.
 */
export const useProcessStore = create<ProcessStore>( ( set, get ) => ( {
    processes: [],
    _createProcessWrapper: ( id: string, process: IncrementalProcess ) => ( {
        id,
        increment: () => get().increment( id ),
        add: ( additional: number ) => {
            process.max += additional;
        },
        complete() {
            get().complete( id );
        }
    } ),
    create: ( label: string, max = PROCESS_MAX ) => {
        const id = MathUtils.generateUUID();
        log.debug( "@process/init: " + label );

        performance.mark( `process-${id}` );

        const process = {
            label,
            id,
            current: 0,
            max,
        };

        set( ( { processes } ) => ( {
            processes: [ ...processes, process ],
        } ) );

        setTimeout(() => {
            if (get().processes.includes(process)) {
                log.warn(`@process/stuck: ${label}`);
            }
        }, 30_000);

        return get()._createProcessWrapper( id, process );
    },

    increment: ( id: string, step = 1 ) => {
        requestAnimationFrame( () => {
            const process = get().processes.find( ( p ) => p.id === id );

            if ( process ) {
                const next = Math.min( process.current + step, process.max );

                set( ( state ) => ( {
                    processes: state.processes.map( ( p ) =>
                        p.id === id ? { ...p, current: next } : p
                    ),
                } ) );

                if ( next === process.max ) {
                    const perf = performance.measure( `process-${id}` );
                    performance.clearMarks( `process-${id}` );
                    performance.clearMeasures( `process-${id}` );
                    log.debug( `@process/complete: ${process.label} ${perf.duration}ms` );
                }
            }
        } );
    },
    complete(label: string) {
        get().increment( label, PROCESS_MAX );
    },
    clearAll: () => {
        set( {
            processes: [],
        } );
    },
    clearCompleted() {
        set( ( { processes } ) => ( {
            processes: processes.filter( ( p ) => !get().isComplete( p.id ) ),
        } ) );
    },
    isInProgress: ( id: string ) =>
        get().processes.some( ( p ) => p.id === id && p.current < p.max ),
    isComplete: ( id: string ) =>
        get().processes.some( ( p ) => p.id === id && p.current >= p.max ),
    inProgress: () => get().processes.filter( ( p ) => p.current < p.max ),
    getTotalProgress: () => {
        let total = 0,
            process = 0;
        for ( const p of get().processes ) {
            total += p.max;
            process += p.current;
        }
        const t = total > 0 ? process / total : 0;

        return t;
    },
} ) );

export default () => useProcessStore.getState();