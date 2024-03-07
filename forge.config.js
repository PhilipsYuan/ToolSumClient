module.exports = {
  packagerConfig: {
    appBundleId: 'com.feiaci.xiaohualun',
    icon: './icons/icons/icon',
    name: 'xhl',
    productName: '小滑轮',
    ignore: [/\.yarn/, /\.idea/, /temp/, /doc/, /src\/render/, /ffmpegPlatforms/, /config/,
      /yarn-error.log/, /\.lock/, /.gitignore/],
    osxSign: {
      identity: 'Developer ID Application: philips yuan (88A2BYST88)',
      "hardened-runtime": false,
      entitlements: "entitlements.plist",
      "entitlements-inherit": "entitlements.plist",
      "signature-flags": "library"
    },
    // osxNotarize: {
    //   // tool: "notarytool",
    //   appleId: 'yuanfei891219@aliyun.com',
    //   appleIdPassword: 'kjnx-fksm-vkqo-iqgf',
    //   teamId: '88A2BYST88'
    // }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {},
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // authors: 'My Name',
        // description: 'My Description',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', "win32"],
      config: {
        options: {
          icon: './icons/icons/icon.icns'
        }
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: '/icons/icons'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: '/icons/icons'
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main/main.js',
            config: 'vite.main.config.mjs',
          },
          {
            entry: 'src/preload/preload.js',
            config: 'vite.preload.config.mjs',
          },
          {
            entry: 'src/main/videoDownload/videoType/m3u8Video/downloadTs.js',
            config: 'vite.preload.config.mjs',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
  ],
};
