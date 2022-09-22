import { settingsStore } from "@stores/settings-store";

export type MatchingKeys<
    TRecord,
    TMatch,
    K extends keyof TRecord = keyof TRecord
    > = K extends (TRecord[K] extends TMatch ? K : never) ? K : never;

export type VoidKeys<Record> = MatchingKeys<Record, void>;

export class TypeEmitter<T>  {

    #listeners: Map<keyof T, ((v: T[keyof T] | undefined) => void | false)[]> = new Map();

    on<K extends keyof T>(s: K, listener: (v: T[K]) => void) {
        //TODO: fixme
        //@ts-ignore
        this.#listeners.set(s, (this.#listeners.get(s) || []).concat(listener));
        return () => this.off(s, listener);
    }

    off<K extends keyof T>(s: K, listener: (v: T[K]) => void): void {
        this.#listeners.set(s, (this.#listeners.get(s) || []).filter(l => l !== listener));
    }

    emit(s: keyof T, v?: T[keyof T]): void | false {

        for (const listener of this.#listeners.get(s) ?? []) {
            if (listener(v) === false) {
                return false;
            }
        }

        if (settingsStore().data.utilities.logLevel === "debug") {
            if (!(s as string).startsWith("image") || Math.random() > 0.99) {
                console.debug(`[TypeEmitter] ${s} emitted`, v);
            }
        }

    }

    dispose() {
        this.#listeners.clear();
    }

}