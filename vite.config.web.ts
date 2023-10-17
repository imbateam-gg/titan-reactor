import { rmSync } from "fs";
import { defineConfig } from "vite";
import esmodule from "vite-plugin-esmodule";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";
import aliases from "./build/aliases";
import path from "path";
import tsConfig from "./tsconfig.json"

const OUT_DIR = "dist/web";

rmSync(OUT_DIR, { recursive: true, force: true }); // v14.14.0

const alias = Object.entries(aliases).reduce(
    (acc, [key, aliasPath]) => {
        acc[key] = path.resolve(aliasPath);
        return acc;
    },
    {
        common: path.resolve("./src/common"),
    }
);

export const sharedViteConfig = ({ command }) => ({
    define: {
        __static: JSON.stringify(
            command === "build" ? "./resources/bundled" : "./bundled"
        ),
    },
    resolve: {
        alias,
    },
    optimizeDeps: {
        exclude: ["bw-casclib"],
        esbuildOptions: {
            target: tsConfig.compilerOptions.target,
            define: {
                global: "globalThis",
            },
            supported: {
                bigint: true,
            },
        },
    },
});

// https://vitejs.dev/config/
export default defineConfig((env) => {
    return {
        ...sharedViteConfig(env),
        
        logLevel: "info",
        publicDir: "bundled",
        build: {
            outDir: OUT_DIR,
            target: tsConfig.compilerOptions.target,
            rollupOptions: {
                input: {
                    index: path.resolve(__dirname, "./index.html"),
                    // command: path.resolve(__dirname, "./command-center.html"),
                    // iscriptah: path.resolve(__dirname, "./iscriptah.html"),
                },
            },
            minify: false,
        },
        esbuild: {
            target: tsConfig.compilerOptions.target,
        },

        worker: {
            format: "es",
        },
        plugins: [
            react(),
            // esmodule(["minipass-fetch", "make-fetch-happen", "libnpmsearch"]),
        ],
        server: process.env.VSCODE_DEBUG
            ? {
                  host: pkg.debug.env.VITE_DEV_SERVER_HOSTNAME,
                  port: pkg.debug.env.VITE_DEV_SERVER_PORT,
              }
            : undefined,
    };
});
