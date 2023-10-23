// import { app } from "electron";
import { defaultSettings } from "common/default-settings";
import { Settings as SettingsType, SettingsMeta, PluginConfig } from "common/types";

import { doMigrations } from "../../main/settings/migrate";
import { sanitizeMacros } from "common/macros/sanitize-macros";
import { PluginsRepository } from "./plugin-repository";
import { SettingsAdapter } from "@stores/settings-adapters/settings-adapter";

// import { DEFAULT_PLUGIN_PACKAGES } from "common/default-settings";
import semver from "semver";
import { HostApiVersion } from "common/utils/api-version";

import deepMerge from "deepmerge";
import { arrayOverwriteMerge } from "@utils/object-utils";

/**
 * A settings management utility which saves and loads settings from a file.
 * It will also emit a "change" event whenever the settings are loaded or saved.
 */
export class SettingsRepository {
    #adapter: SettingsAdapter;
    #settings: SettingsType = {
        ...defaultSettings,
    };
    readonly plugins: PluginsRepository;
    #pluginSettings: Record<string, PluginConfig> = {};

    constructor( adapter: SettingsAdapter ) {
        this.#adapter = adapter;
        this.plugins = new PluginsRepository();
    }

    #isPluginIncompatible( apiVersion: string ) {
        return semver.major( HostApiVersion ) !== semver.major( apiVersion );
    }

    get activatedPlugins() {
        return this.plugins.getAllPlugins().filter( ( p ) => {
            const pluginSettings = this.#pluginSettings[p.name];
            if ( !pluginSettings.enabled?.value ) {
                return false;
            }

            if ( this.#isPluginIncompatible( p.apiVersion ) ) {
                return false;
            }

            return true;
        } );
    }

    get deactivatedPlugins() {
        return this.plugins
            .getAllPlugins()
            .filter( ( p ) => !this.activatedPlugins.find( ( ap ) => ap.name === p.name ) );
    }

    //todo: add error handling
    async init() {
        const settings = await this.#adapter.loadSettings();
        this.#settings = doMigrations( settings );

        await this.plugins.init(
            process.env.NODE_ENV === "development"
                ? "http://localhost:8090"
                : "https://plugins-o8a.pages.dev/"
        );

        for ( const plugin of this.plugins.getAllPlugins() ) {
            plugin.config =
                ( await this.#adapter.loadPluginSettings( plugin.name ) ) ?? plugin.config;
            this.#pluginSettings[plugin.name] = plugin.config ?? {};
        }

        await this.save();

        return this.getMeta();
    }

    get() {
        return this.#settings;
    }

    // async deactivePlugins( pluginIds: string[] ) {
    //     const plugins = this.activatedPlugins.filter( ( p ) => pluginIds.includes( p.id ) );
    //     const pluginNames = plugins.map( ( p ) => p.name );

    //     if ( plugins.length ) {
    //         await this.save( {
    //             plugins: {
    //                 ...this.#settings.plugins,
    //                 activated: this.#settings.plugins.activated.filter(
    //                     ( p ) => !pluginNames.includes( p )
    //                 ),
    //             },
    //         } );

    //         return plugins;
    //     }
    // }

    // async activatePlugins( pluginIds: string[] ) {
    //     const plugins = this.deactivatedPlugins.filter( ( p ) => pluginIds.includes( p.id ) );

    //     if ( plugins.length ) {
    //         await this.save( {
    //             plugins: {
    //                 ...this.#settings.plugins,
    //                 activated: uniq( [
    //                     ...this.#settings.plugins.activated,
    //                     ...plugins.map( ( p ) => p.name ),
    //                 ] ),
    //             },
    //         } );

    //         return plugins;
    //     }
    // }

    getMeta(): SettingsMeta {
        const errors: string[] = [];

        const macros = sanitizeMacros( this.#settings.macros, {
            data: this.#settings,
            activatedPlugins: this.activatedPlugins,
        } );

        return {
            data: { ...this.#settings, macros },
            errors,
            initialInstall: false,
            activatedPlugins: this.activatedPlugins,
            deactivatedPlugins: this.deactivatedPlugins,
        };
    }

    /**
     * Saves the settings to disk. Will ignore any existing errors.
     * Emits the "change" event.
     * @param settings
     */
    async save( settings: Partial<SettingsType> = {} ) {
        this.#settings = Object.assign( {}, this.#settings, settings );
        this.#settings.macros = sanitizeMacros( this.#settings.macros, {
            data: this.#settings,
            activatedPlugins: this.activatedPlugins,
        } );

        await this.#adapter.saveSettings( this.#settings );

        return this.#settings;
    }

    async savePluginConfig( pluginId: string, config: PluginConfig ) {
        const plugin = this.plugins.getAllPlugins().find( ( p ) => p.id === pluginId );
        if ( !plugin ) {
            // log.error(
            //     `@settings/load-plugins: Could not find plugin with id ${pluginId}`
            // );
            return;
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            plugin.config = deepMerge( plugin.config ?? {}, config, {
                arrayMerge: arrayOverwriteMerge,
            } );

            await this.#adapter.savePluginSettings( plugin.name, plugin.config );
        } catch ( e ) {
            // log.error(
            //     withErrorMessage(
            //         e,
            //         "@save-plugins-config: Error writing plugin package.json"
            //     )
            // );
            return;
        }
    }
}
