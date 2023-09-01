import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue'
import inject from '@rollup/plugin-inject'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        AutoImport({
            resolvers: [ElementPlusResolver()],
        }),
        Components({
            resolvers: [ElementPlusResolver()],
        }),
        vue(),
        inject({
            $: 'jquery',
            jquery: 'jquery',
            'window.jQuery': 'jquery',
            jQuery: 'jquery'
        }),
    ],
    root: "./src/renderer",
    server: {
        port: 8001
    },
    css: {
        preprocessorOptions: {
            //define global scss variable
            scss: {
                additionalData: ``
            }
        }
    }
});
