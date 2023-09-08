import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    define: {
        'process.env.FLUENTFFMPEG_COV': false,
        'process.env.mode': 'develop'
    },
});
