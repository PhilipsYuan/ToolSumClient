import require$$0$4 from 'child_process';
import require$$0 from 'fs';
import require$$0$3 from 'os';
import require$$0$1 from 'path';
import require$$4$1 from 'readline';
import require$$1 from 'http';
import require$$2 from 'https';
import require$$3 from 'url';
import require$$4 from 'proxy-agent';
import require$$0$2 from 'debug';
import require$$0$5 from 'assert';
import require$$2$1 from 'fs/promises';
import require$$4$2 from 'util';
import require$$5 from 'extract-zip';
import require$$6 from 'tar-fs';
import require$$7 from 'unbzip2-stream';
import require$$0$6 from 'process';
import require$$2$2 from 'progress';
import require$$3$1 from './yargs/helpers';
import require$$4$3 from './yargs/yargs';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var main$1 = {};

var launch = {};

var browserData = {};

var chromeHeadlessShell = {};

var types = {};

var chrome = {};

var httpUtil = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding$2 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault$2 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar$2 = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding$2(result, mod, k);
    __setModuleDefault$2(result, mod);
    return result;
};
Object.defineProperty(httpUtil, "__esModule", { value: true });
httpUtil.getText = httpUtil.getJSON = httpUtil.downloadFile = httpUtil.httpRequest = httpUtil.headHttpRequest = void 0;
const fs_1$2 = require$$0;
const http = __importStar$2(require$$1);
const https = __importStar$2(require$$2);
const url_1 = require$$3;
const proxy_agent_1 = require$$4;
function headHttpRequest(url) {
    return new Promise(resolve => {
        const request = httpRequest(url, 'HEAD', response => {
            // consume response data free node process
            response.resume();
            resolve(response.statusCode === 200);
        }, false);
        request.on('error', () => {
            resolve(false);
        });
    });
}
httpUtil.headHttpRequest = headHttpRequest;
function httpRequest(url, method, response, keepAlive = true) {
    const options = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: keepAlive ? { Connection: 'keep-alive' } : undefined,
        auth: (0, url_1.urlToHttpOptions)(url).auth,
        agent: new proxy_agent_1.ProxyAgent(),
    };
    const requestCallback = (res) => {
        if (res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location) {
            httpRequest(new url_1.URL(res.headers.location), method, response);
        }
        else {
            response(res);
        }
    };
    const request = options.protocol === 'https:'
        ? https.request(options, requestCallback)
        : http.request(options, requestCallback);
    request.end();
    return request;
}
httpUtil.httpRequest = httpRequest;
/**
 * @internal
 */
function downloadFile(url, destinationPath, progressCallback) {
    return new Promise((resolve, reject) => {
        let downloadedBytes = 0;
        let totalBytes = 0;
        function onData(chunk) {
            downloadedBytes += chunk.length;
            progressCallback(downloadedBytes, totalBytes);
        }
        const request = httpRequest(url, 'GET', response => {
            if (response.statusCode !== 200) {
                const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
                // consume response data to free up memory
                response.resume();
                reject(error);
                return;
            }
            const file = (0, fs_1$2.createWriteStream)(destinationPath);
            file.on('finish', () => {
                return resolve();
            });
            file.on('error', error => {
                return reject(error);
            });
            response.pipe(file);
            totalBytes = parseInt(response.headers['content-length'], 10);
            if (progressCallback) {
                response.on('data', onData);
            }
        });
        request.on('error', error => {
            return reject(error);
        });
    });
}
httpUtil.downloadFile = downloadFile;
async function getJSON(url) {
    const text = await getText(url);
    try {
        return JSON.parse(text);
    }
    catch {
        throw new Error('Could not parse JSON from ' + url.toString());
    }
}
httpUtil.getJSON = getJSON;
function getText(url) {
    return new Promise((resolve, reject) => {
        const request = httpRequest(url, 'GET', response => {
            let data = '';
            if (response.statusCode && response.statusCode >= 400) {
                return reject(new Error(`Got status code ${response.statusCode}`));
            }
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    return resolve(String(data));
                }
                catch {
                    return reject(new Error('Chrome version not found'));
                }
            });
        }, false);
        request.on('error', err => {
            reject(err);
        });
    });
}
httpUtil.getText = getText;

var hasRequiredChrome;

function requireChrome () {
	if (hasRequiredChrome) return chrome;
	hasRequiredChrome = 1;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(chrome, "__esModule", { value: true });
	chrome.resolveSystemExecutablePath = chrome.resolveBuildId = chrome.getLastKnownGoodReleaseForBuild = chrome.getLastKnownGoodReleaseForMilestone = chrome.getLastKnownGoodReleaseForChannel = chrome.relativeExecutablePath = chrome.resolveDownloadPath = chrome.resolveDownloadUrl = void 0;
	const path_1 = __importDefault(require$$0$1);
	const httpUtil_js_1 = httpUtil;
	const types_js_1 = requireTypes();
	function folder(platform) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.LINUX:
	            return 'linux64';
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return 'mac-arm64';
	        case types_js_1.BrowserPlatform.MAC:
	            return 'mac-x64';
	        case types_js_1.BrowserPlatform.WIN32:
	            return 'win32';
	        case types_js_1.BrowserPlatform.WIN64:
	            return 'win64';
	    }
	}
	function resolveDownloadUrl(platform, buildId, baseUrl = 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing') {
	    return `${baseUrl}/${resolveDownloadPath(platform, buildId).join('/')}`;
	}
	chrome.resolveDownloadUrl = resolveDownloadUrl;
	function resolveDownloadPath(platform, buildId) {
	    return [buildId, folder(platform), `chrome-${folder(platform)}.zip`];
	}
	chrome.resolveDownloadPath = resolveDownloadPath;
	function relativeExecutablePath(platform, _buildId) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.MAC:
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return path_1.default.join('chrome-' + folder(platform), 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
	        case types_js_1.BrowserPlatform.LINUX:
	            return path_1.default.join('chrome-linux64', 'chrome');
	        case types_js_1.BrowserPlatform.WIN32:
	        case types_js_1.BrowserPlatform.WIN64:
	            return path_1.default.join('chrome-' + folder(platform), 'chrome.exe');
	    }
	}
	chrome.relativeExecutablePath = relativeExecutablePath;
	async function getLastKnownGoodReleaseForChannel(channel) {
	    const data = (await (0, httpUtil_js_1.getJSON)(new URL('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json')));
	    for (const channel of Object.keys(data.channels)) {
	        data.channels[channel.toLowerCase()] = data.channels[channel];
	        delete data.channels[channel];
	    }
	    return data.channels[channel];
	}
	chrome.getLastKnownGoodReleaseForChannel = getLastKnownGoodReleaseForChannel;
	async function getLastKnownGoodReleaseForMilestone(milestone) {
	    const data = (await (0, httpUtil_js_1.getJSON)(new URL('https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone.json')));
	    return data.milestones[milestone];
	}
	chrome.getLastKnownGoodReleaseForMilestone = getLastKnownGoodReleaseForMilestone;
	async function getLastKnownGoodReleaseForBuild(
	/**
	 * @example `112.0.23`,
	 */
	buildPrefix) {
	    const data = (await (0, httpUtil_js_1.getJSON)(new URL('https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build.json')));
	    return data.builds[buildPrefix];
	}
	chrome.getLastKnownGoodReleaseForBuild = getLastKnownGoodReleaseForBuild;
	async function resolveBuildId(channel) {
	    if (Object.values(types_js_1.ChromeReleaseChannel).includes(channel)) {
	        return (await getLastKnownGoodReleaseForChannel(channel)).version;
	    }
	    if (channel.match(/^\d+$/)) {
	        // Potentially a milestone.
	        return (await getLastKnownGoodReleaseForMilestone(channel))?.version;
	    }
	    if (channel.match(/^\d+\.\d+\.\d+$/)) {
	        // Potentially a build prefix without the patch version.
	        return (await getLastKnownGoodReleaseForBuild(channel))?.version;
	    }
	    return;
	}
	chrome.resolveBuildId = resolveBuildId;
	function resolveSystemExecutablePath(platform, channel) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.WIN64:
	        case types_js_1.BrowserPlatform.WIN32:
	            switch (channel) {
	                case types_js_1.ChromeReleaseChannel.STABLE:
	                    return `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`;
	                case types_js_1.ChromeReleaseChannel.BETA:
	                    return `${process.env['PROGRAMFILES']}\\Google\\Chrome Beta\\Application\\chrome.exe`;
	                case types_js_1.ChromeReleaseChannel.CANARY:
	                    return `${process.env['PROGRAMFILES']}\\Google\\Chrome SxS\\Application\\chrome.exe`;
	                case types_js_1.ChromeReleaseChannel.DEV:
	                    return `${process.env['PROGRAMFILES']}\\Google\\Chrome Dev\\Application\\chrome.exe`;
	            }
	        case types_js_1.BrowserPlatform.MAC_ARM:
	        case types_js_1.BrowserPlatform.MAC:
	            switch (channel) {
	                case types_js_1.ChromeReleaseChannel.STABLE:
	                    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	                case types_js_1.ChromeReleaseChannel.BETA:
	                    return '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta';
	                case types_js_1.ChromeReleaseChannel.CANARY:
	                    return '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
	                case types_js_1.ChromeReleaseChannel.DEV:
	                    return '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev';
	            }
	        case types_js_1.BrowserPlatform.LINUX:
	            switch (channel) {
	                case types_js_1.ChromeReleaseChannel.STABLE:
	                    return '/opt/google/chrome/chrome';
	                case types_js_1.ChromeReleaseChannel.BETA:
	                    return '/opt/google/chrome-beta/chrome';
	                case types_js_1.ChromeReleaseChannel.DEV:
	                    return '/opt/google/chrome-unstable/chrome';
	            }
	    }
	    throw new Error(`Unable to detect browser executable path for '${channel}' on ${platform}.`);
	}
	chrome.resolveSystemExecutablePath = resolveSystemExecutablePath;
	
	return chrome;
}

var firefox = {};

var hasRequiredFirefox;

function requireFirefox () {
	if (hasRequiredFirefox) return firefox;
	hasRequiredFirefox = 1;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(firefox, "__esModule", { value: true });
	firefox.createProfile = firefox.resolveBuildId = firefox.relativeExecutablePath = firefox.resolveDownloadPath = firefox.resolveDownloadUrl = void 0;
	const fs_1 = __importDefault(require$$0);
	const path_1 = __importDefault(require$$0$1);
	const httpUtil_js_1 = httpUtil;
	const types_js_1 = requireTypes();
	function archive(platform, buildId) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.LINUX:
	            return `firefox-${buildId}.en-US.${platform}-x86_64.tar.bz2`;
	        case types_js_1.BrowserPlatform.MAC_ARM:
	        case types_js_1.BrowserPlatform.MAC:
	            return `firefox-${buildId}.en-US.mac.dmg`;
	        case types_js_1.BrowserPlatform.WIN32:
	        case types_js_1.BrowserPlatform.WIN64:
	            return `firefox-${buildId}.en-US.${platform}.zip`;
	    }
	}
	function resolveDownloadUrl(platform, buildId, baseUrl = 'https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central') {
	    return `${baseUrl}/${resolveDownloadPath(platform, buildId).join('/')}`;
	}
	firefox.resolveDownloadUrl = resolveDownloadUrl;
	function resolveDownloadPath(platform, buildId) {
	    return [archive(platform, buildId)];
	}
	firefox.resolveDownloadPath = resolveDownloadPath;
	function relativeExecutablePath(platform, _buildId) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.MAC_ARM:
	        case types_js_1.BrowserPlatform.MAC:
	            return path_1.default.join('Firefox Nightly.app', 'Contents', 'MacOS', 'firefox');
	        case types_js_1.BrowserPlatform.LINUX:
	            return path_1.default.join('firefox', 'firefox');
	        case types_js_1.BrowserPlatform.WIN32:
	        case types_js_1.BrowserPlatform.WIN64:
	            return path_1.default.join('firefox', 'firefox.exe');
	    }
	}
	firefox.relativeExecutablePath = relativeExecutablePath;
	async function resolveBuildId(channel = 'FIREFOX_NIGHTLY') {
	    const versions = (await (0, httpUtil_js_1.getJSON)(new URL('https://product-details.mozilla.org/1.0/firefox_versions.json')));
	    const version = versions[channel];
	    if (!version) {
	        throw new Error(`Channel ${channel} is not found.`);
	    }
	    return version;
	}
	firefox.resolveBuildId = resolveBuildId;
	async function createProfile(options) {
	    if (!fs_1.default.existsSync(options.path)) {
	        await fs_1.default.promises.mkdir(options.path, {
	            recursive: true,
	        });
	    }
	    await writePreferences({
	        preferences: {
	            ...defaultProfilePreferences(options.preferences),
	            ...options.preferences,
	        },
	        path: options.path,
	    });
	}
	firefox.createProfile = createProfile;
	function defaultProfilePreferences(extraPrefs) {
	    const server = 'dummy.test';
	    const defaultPrefs = {
	        // Make sure Shield doesn't hit the network.
	        'app.normandy.api_url': '',
	        // Disable Firefox old build background check
	        'app.update.checkInstallTime': false,
	        // Disable automatically upgrading Firefox
	        'app.update.disabledForTesting': true,
	        // Increase the APZ content response timeout to 1 minute
	        'apz.content_response_timeout': 60000,
	        // Prevent various error message on the console
	        // jest-puppeteer asserts that no error message is emitted by the console
	        'browser.contentblocking.features.standard': '-tp,tpPrivate,cookieBehavior0,-cm,-fp',
	        // Enable the dump function: which sends messages to the system
	        // console
	        // https://bugzilla.mozilla.org/show_bug.cgi?id=1543115
	        'browser.dom.window.dump.enabled': true,
	        // Disable topstories
	        'browser.newtabpage.activity-stream.feeds.system.topstories': false,
	        // Always display a blank page
	        'browser.newtabpage.enabled': false,
	        // Background thumbnails in particular cause grief: and disabling
	        // thumbnails in general cannot hurt
	        'browser.pagethumbnails.capturing_disabled': true,
	        // Disable safebrowsing components.
	        'browser.safebrowsing.blockedURIs.enabled': false,
	        'browser.safebrowsing.downloads.enabled': false,
	        'browser.safebrowsing.malware.enabled': false,
	        'browser.safebrowsing.passwords.enabled': false,
	        'browser.safebrowsing.phishing.enabled': false,
	        // Disable updates to search engines.
	        'browser.search.update': false,
	        // Do not restore the last open set of tabs if the browser has crashed
	        'browser.sessionstore.resume_from_crash': false,
	        // Skip check for default browser on startup
	        'browser.shell.checkDefaultBrowser': false,
	        // Disable newtabpage
	        'browser.startup.homepage': 'about:blank',
	        // Do not redirect user when a milstone upgrade of Firefox is detected
	        'browser.startup.homepage_override.mstone': 'ignore',
	        // Start with a blank page about:blank
	        'browser.startup.page': 0,
	        // Do not allow background tabs to be zombified on Android: otherwise for
	        // tests that open additional tabs: the test harness tab itself might get
	        // unloaded
	        'browser.tabs.disableBackgroundZombification': false,
	        // Do not warn when closing all other open tabs
	        'browser.tabs.warnOnCloseOtherTabs': false,
	        // Do not warn when multiple tabs will be opened
	        'browser.tabs.warnOnOpen': false,
	        // Do not automatically offer translations, as tests do not expect this.
	        'browser.translations.automaticallyPopup': false,
	        // Disable the UI tour.
	        'browser.uitour.enabled': false,
	        // Turn off search suggestions in the location bar so as not to trigger
	        // network connections.
	        'browser.urlbar.suggest.searches': false,
	        // Disable first run splash page on Windows 10
	        'browser.usedOnWindows10.introURL': '',
	        // Do not warn on quitting Firefox
	        'browser.warnOnQuit': false,
	        // Defensively disable data reporting systems
	        'datareporting.healthreport.documentServerURI': `http://${server}/dummy/healthreport/`,
	        'datareporting.healthreport.logging.consoleEnabled': false,
	        'datareporting.healthreport.service.enabled': false,
	        'datareporting.healthreport.service.firstRun': false,
	        'datareporting.healthreport.uploadEnabled': false,
	        // Do not show datareporting policy notifications which can interfere with tests
	        'datareporting.policy.dataSubmissionEnabled': false,
	        'datareporting.policy.dataSubmissionPolicyBypassNotification': true,
	        // DevTools JSONViewer sometimes fails to load dependencies with its require.js.
	        // This doesn't affect Puppeteer but spams console (Bug 1424372)
	        'devtools.jsonview.enabled': false,
	        // Disable popup-blocker
	        'dom.disable_open_during_load': false,
	        // Enable the support for File object creation in the content process
	        // Required for |Page.setFileInputFiles| protocol method.
	        'dom.file.createInChild': true,
	        // Disable the ProcessHangMonitor
	        'dom.ipc.reportProcessHangs': false,
	        // Disable slow script dialogues
	        'dom.max_chrome_script_run_time': 0,
	        'dom.max_script_run_time': 0,
	        // Only load extensions from the application and user profile
	        // AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_APPLICATION
	        'extensions.autoDisableScopes': 0,
	        'extensions.enabledScopes': 5,
	        // Disable metadata caching for installed add-ons by default
	        'extensions.getAddons.cache.enabled': false,
	        // Disable installing any distribution extensions or add-ons.
	        'extensions.installDistroAddons': false,
	        // Disabled screenshots extension
	        'extensions.screenshots.disabled': true,
	        // Turn off extension updates so they do not bother tests
	        'extensions.update.enabled': false,
	        // Turn off extension updates so they do not bother tests
	        'extensions.update.notifyUser': false,
	        // Make sure opening about:addons will not hit the network
	        'extensions.webservice.discoverURL': `http://${server}/dummy/discoveryURL`,
	        // Temporarily force disable BFCache in parent (https://bit.ly/bug-1732263)
	        'fission.bfcacheInParent': false,
	        // Force all web content to use a single content process
	        'fission.webContentIsolationStrategy': 0,
	        // Allow the application to have focus even it runs in the background
	        'focusmanager.testmode': true,
	        // Disable useragent updates
	        'general.useragent.updates.enabled': false,
	        // Always use network provider for geolocation tests so we bypass the
	        // macOS dialog raised by the corelocation provider
	        'geo.provider.testing': true,
	        // Do not scan Wifi
	        'geo.wifi.scan': false,
	        // No hang monitor
	        'hangmonitor.timeout': 0,
	        // Show chrome errors and warnings in the error console
	        'javascript.options.showInConsole': true,
	        // Disable download and usage of OpenH264: and Widevine plugins
	        'media.gmp-manager.updateEnabled': false,
	        // Prevent various error message on the console
	        // jest-puppeteer asserts that no error message is emitted by the console
	        'network.cookie.cookieBehavior': 0,
	        // Disable experimental feature that is only available in Nightly
	        'network.cookie.sameSite.laxByDefault': false,
	        // Do not prompt for temporary redirects
	        'network.http.prompt-temp-redirect': false,
	        // Disable speculative connections so they are not reported as leaking
	        // when they are hanging around
	        'network.http.speculative-parallel-limit': 0,
	        // Do not automatically switch between offline and online
	        'network.manage-offline-status': false,
	        // Make sure SNTP requests do not hit the network
	        'network.sntp.pools': server,
	        // Disable Flash.
	        'plugin.state.flash': 0,
	        'privacy.trackingprotection.enabled': false,
	        // Can be removed once Firefox 89 is no longer supported
	        // https://bugzilla.mozilla.org/show_bug.cgi?id=1710839
	        'remote.enabled': true,
	        // Don't do network connections for mitm priming
	        'security.certerrors.mitm.priming.enabled': false,
	        // Local documents have access to all other local documents,
	        // including directory listings
	        'security.fileuri.strict_origin_policy': false,
	        // Do not wait for the notification button security delay
	        'security.notification_enable_delay': 0,
	        // Ensure blocklist updates do not hit the network
	        'services.settings.server': `http://${server}/dummy/blocklist/`,
	        // Do not automatically fill sign-in forms with known usernames and
	        // passwords
	        'signon.autofillForms': false,
	        // Disable password capture, so that tests that include forms are not
	        // influenced by the presence of the persistent doorhanger notification
	        'signon.rememberSignons': false,
	        // Disable first-run welcome page
	        'startup.homepage_welcome_url': 'about:blank',
	        // Disable first-run welcome page
	        'startup.homepage_welcome_url.additional': '',
	        // Disable browser animations (tabs, fullscreen, sliding alerts)
	        'toolkit.cosmeticAnimations.enabled': false,
	        // Prevent starting into safe mode after application crashes
	        'toolkit.startup.max_resumed_crashes': -1,
	    };
	    return Object.assign(defaultPrefs, extraPrefs);
	}
	/**
	 * Populates the user.js file with custom preferences as needed to allow
	 * Firefox's CDP support to properly function. These preferences will be
	 * automatically copied over to prefs.js during startup of Firefox. To be
	 * able to restore the original values of preferences a backup of prefs.js
	 * will be created.
	 *
	 * @param prefs - List of preferences to add.
	 * @param profilePath - Firefox profile to write the preferences to.
	 */
	async function writePreferences(options) {
	    const lines = Object.entries(options.preferences).map(([key, value]) => {
	        return `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`;
	    });
	    await fs_1.default.promises.writeFile(path_1.default.join(options.path, 'user.js'), lines.join('\n'));
	    // Create a backup of the preferences file if it already exitsts.
	    const prefsPath = path_1.default.join(options.path, 'prefs.js');
	    if (fs_1.default.existsSync(prefsPath)) {
	        const prefsBackupPath = path_1.default.join(options.path, 'prefs.js.puppeteer');
	        await fs_1.default.promises.copyFile(prefsPath, prefsBackupPath);
	    }
	}
	
	return firefox;
}

var hasRequiredTypes;

function requireTypes () {
	if (hasRequiredTypes) return types;
	hasRequiredTypes = 1;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
	    if (mod && mod.__esModule) return mod;
	    var result = {};
	    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	    __setModuleDefault(result, mod);
	    return result;
	};
	Object.defineProperty(types, "__esModule", { value: true });
	types.ChromeReleaseChannel = types.BrowserTag = types.downloadUrls = types.BrowserPlatform = types.Browser = void 0;
	const chrome = __importStar(requireChrome());
	const firefox = __importStar(requireFirefox());
	/**
	 * Supported browsers.
	 *
	 * @public
	 */
	var Browser;
	(function (Browser) {
	    Browser["CHROME"] = "chrome";
	    Browser["CHROMEHEADLESSSHELL"] = "chrome-headless-shell";
	    Browser["CHROMIUM"] = "chromium";
	    Browser["FIREFOX"] = "firefox";
	    Browser["CHROMEDRIVER"] = "chromedriver";
	})(Browser || (types.Browser = Browser = {}));
	/**
	 * Platform names used to identify a OS platfrom x architecture combination in the way
	 * that is relevant for the browser download.
	 *
	 * @public
	 */
	var BrowserPlatform;
	(function (BrowserPlatform) {
	    BrowserPlatform["LINUX"] = "linux";
	    BrowserPlatform["MAC"] = "mac";
	    BrowserPlatform["MAC_ARM"] = "mac_arm";
	    BrowserPlatform["WIN32"] = "win32";
	    BrowserPlatform["WIN64"] = "win64";
	})(BrowserPlatform || (types.BrowserPlatform = BrowserPlatform = {}));
	types.downloadUrls = {
	    [Browser.CHROME]: chrome.resolveDownloadUrl,
	    [Browser.CHROMIUM]: chrome.resolveDownloadUrl,
	    [Browser.FIREFOX]: firefox.resolveDownloadUrl,
	};
	/**
	 * @public
	 */
	var BrowserTag;
	(function (BrowserTag) {
	    BrowserTag["CANARY"] = "canary";
	    BrowserTag["BETA"] = "beta";
	    BrowserTag["DEV"] = "dev";
	    BrowserTag["STABLE"] = "stable";
	    BrowserTag["LATEST"] = "latest";
	})(BrowserTag || (types.BrowserTag = BrowserTag = {}));
	/**
	 * @public
	 */
	var ChromeReleaseChannel;
	(function (ChromeReleaseChannel) {
	    ChromeReleaseChannel["STABLE"] = "stable";
	    ChromeReleaseChannel["DEV"] = "dev";
	    ChromeReleaseChannel["CANARY"] = "canary";
	    ChromeReleaseChannel["BETA"] = "beta";
	})(ChromeReleaseChannel || (types.ChromeReleaseChannel = ChromeReleaseChannel = {}));
	
	return types;
}

(function (exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.resolveBuildId = exports.relativeExecutablePath = exports.resolveDownloadPath = exports.resolveDownloadUrl = void 0;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const path_1 = __importDefault(require$$0$1);
	const types_js_1 = requireTypes();
	function folder(platform) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.LINUX:
	            return 'linux64';
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return 'mac-arm64';
	        case types_js_1.BrowserPlatform.MAC:
	            return 'mac-x64';
	        case types_js_1.BrowserPlatform.WIN32:
	            return 'win32';
	        case types_js_1.BrowserPlatform.WIN64:
	            return 'win64';
	    }
	}
	function resolveDownloadUrl(platform, buildId, baseUrl = 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing') {
	    return `${baseUrl}/${resolveDownloadPath(platform, buildId).join('/')}`;
	}
	exports.resolveDownloadUrl = resolveDownloadUrl;
	function resolveDownloadPath(platform, buildId) {
	    return [
	        buildId,
	        folder(platform),
	        `chrome-headless-shell-${folder(platform)}.zip`,
	    ];
	}
	exports.resolveDownloadPath = resolveDownloadPath;
	function relativeExecutablePath(platform, _buildId) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.MAC:
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return path_1.default.join('chrome-headless-shell-' + folder(platform), 'chrome-headless-shell');
	        case types_js_1.BrowserPlatform.LINUX:
	            return path_1.default.join('chrome-headless-shell-linux64', 'chrome-headless-shell');
	        case types_js_1.BrowserPlatform.WIN32:
	        case types_js_1.BrowserPlatform.WIN64:
	            return path_1.default.join('chrome-headless-shell-' + folder(platform), 'chrome-headless-shell.exe');
	    }
	}
	exports.relativeExecutablePath = relativeExecutablePath;
	var chrome_js_1 = requireChrome();
	Object.defineProperty(exports, "resolveBuildId", { enumerable: true, get: function () { return chrome_js_1.resolveBuildId; } });
	
} (chromeHeadlessShell));

var chromedriver = {};

(function (exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.resolveBuildId = exports.relativeExecutablePath = exports.resolveDownloadPath = exports.resolveDownloadUrl = void 0;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	const path_1 = __importDefault(require$$0$1);
	const types_js_1 = requireTypes();
	function folder(platform) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.LINUX:
	            return 'linux64';
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return 'mac-arm64';
	        case types_js_1.BrowserPlatform.MAC:
	            return 'mac-x64';
	        case types_js_1.BrowserPlatform.WIN32:
	            return 'win32';
	        case types_js_1.BrowserPlatform.WIN64:
	            return 'win64';
	    }
	}
	function resolveDownloadUrl(platform, buildId, baseUrl = 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing') {
	    return `${baseUrl}/${resolveDownloadPath(platform, buildId).join('/')}`;
	}
	exports.resolveDownloadUrl = resolveDownloadUrl;
	function resolveDownloadPath(platform, buildId) {
	    return [buildId, folder(platform), `chromedriver-${folder(platform)}.zip`];
	}
	exports.resolveDownloadPath = resolveDownloadPath;
	function relativeExecutablePath(platform, _buildId) {
	    switch (platform) {
	        case types_js_1.BrowserPlatform.MAC:
	        case types_js_1.BrowserPlatform.MAC_ARM:
	            return path_1.default.join('chromedriver-' + folder(platform), 'chromedriver');
	        case types_js_1.BrowserPlatform.LINUX:
	            return path_1.default.join('chromedriver-linux64', 'chromedriver');
	        case types_js_1.BrowserPlatform.WIN32:
	        case types_js_1.BrowserPlatform.WIN64:
	            return path_1.default.join('chromedriver-' + folder(platform), 'chromedriver.exe');
	    }
	}
	exports.relativeExecutablePath = relativeExecutablePath;
	var chrome_js_1 = requireChrome();
	Object.defineProperty(exports, "resolveBuildId", { enumerable: true, get: function () { return chrome_js_1.resolveBuildId; } });
	
} (chromedriver));

var chromium = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault$5 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(chromium, "__esModule", { value: true });
chromium.resolveBuildId = chromium.relativeExecutablePath = chromium.resolveDownloadPath = chromium.resolveDownloadUrl = void 0;
const path_1$1 = __importDefault$5(require$$0$1);
const httpUtil_js_1$1 = httpUtil;
const types_js_1 = requireTypes();
function archive(platform, buildId) {
    switch (platform) {
        case types_js_1.BrowserPlatform.LINUX:
            return 'chrome-linux';
        case types_js_1.BrowserPlatform.MAC_ARM:
        case types_js_1.BrowserPlatform.MAC:
            return 'chrome-mac';
        case types_js_1.BrowserPlatform.WIN32:
        case types_js_1.BrowserPlatform.WIN64:
            // Windows archive name changed at r591479.
            return parseInt(buildId, 10) > 591479 ? 'chrome-win' : 'chrome-win32';
    }
}
function folder(platform) {
    switch (platform) {
        case types_js_1.BrowserPlatform.LINUX:
            return 'Linux_x64';
        case types_js_1.BrowserPlatform.MAC_ARM:
            return 'Mac_Arm';
        case types_js_1.BrowserPlatform.MAC:
            return 'Mac';
        case types_js_1.BrowserPlatform.WIN32:
            return 'Win';
        case types_js_1.BrowserPlatform.WIN64:
            return 'Win_x64';
    }
}
function resolveDownloadUrl(platform, buildId, baseUrl = 'https://storage.googleapis.com/chromium-browser-snapshots') {
    return `${baseUrl}/${resolveDownloadPath(platform, buildId).join('/')}`;
}
chromium.resolveDownloadUrl = resolveDownloadUrl;
function resolveDownloadPath(platform, buildId) {
    return [folder(platform), buildId, `${archive(platform, buildId)}.zip`];
}
chromium.resolveDownloadPath = resolveDownloadPath;
function relativeExecutablePath(platform, _buildId) {
    switch (platform) {
        case types_js_1.BrowserPlatform.MAC:
        case types_js_1.BrowserPlatform.MAC_ARM:
            return path_1$1.default.join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
        case types_js_1.BrowserPlatform.LINUX:
            return path_1$1.default.join('chrome-linux', 'chrome');
        case types_js_1.BrowserPlatform.WIN32:
        case types_js_1.BrowserPlatform.WIN64:
            return path_1$1.default.join('chrome-win', 'chrome.exe');
    }
}
chromium.relativeExecutablePath = relativeExecutablePath;
async function resolveBuildId(platform) {
    return await (0, httpUtil_js_1$1.getText)(new URL(`https://storage.googleapis.com/chromium-browser-snapshots/${folder(platform)}/LAST_CHANGE`));
}
chromium.resolveBuildId = resolveBuildId;

(function (exports) {
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    var desc = Object.getOwnPropertyDescriptor(m, k);
	    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
	      desc = { enumerable: true, get: function() { return m[k]; } };
	    }
	    Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
	    if (k2 === undefined) k2 = k;
	    o[k2] = m[k];
	}));
	var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
	    Object.defineProperty(o, "default", { enumerable: true, value: v });
	}) : function(o, v) {
	    o["default"] = v;
	});
	var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
	    if (mod && mod.__esModule) return mod;
	    var result = {};
	    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	    __setModuleDefault(result, mod);
	    return result;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.resolveSystemExecutablePath = exports.createProfile = exports.resolveBuildId = exports.ChromeReleaseChannel = exports.BrowserPlatform = exports.Browser = exports.executablePathByBrowser = exports.downloadPaths = exports.downloadUrls = void 0;
	const chromeHeadlessShell$1 = __importStar(chromeHeadlessShell);
	const chrome = __importStar(requireChrome());
	const chromedriver$1 = __importStar(chromedriver);
	const chromium$1 = __importStar(chromium);
	const firefox = __importStar(requireFirefox());
	const types_js_1 = requireTypes();
	Object.defineProperty(exports, "Browser", { enumerable: true, get: function () { return types_js_1.Browser; } });
	Object.defineProperty(exports, "BrowserPlatform", { enumerable: true, get: function () { return types_js_1.BrowserPlatform; } });
	Object.defineProperty(exports, "ChromeReleaseChannel", { enumerable: true, get: function () { return types_js_1.ChromeReleaseChannel; } });
	exports.downloadUrls = {
	    [types_js_1.Browser.CHROMEDRIVER]: chromedriver$1.resolveDownloadUrl,
	    [types_js_1.Browser.CHROMEHEADLESSSHELL]: chromeHeadlessShell$1.resolveDownloadUrl,
	    [types_js_1.Browser.CHROME]: chrome.resolveDownloadUrl,
	    [types_js_1.Browser.CHROMIUM]: chromium$1.resolveDownloadUrl,
	    [types_js_1.Browser.FIREFOX]: firefox.resolveDownloadUrl,
	};
	exports.downloadPaths = {
	    [types_js_1.Browser.CHROMEDRIVER]: chromedriver$1.resolveDownloadPath,
	    [types_js_1.Browser.CHROMEHEADLESSSHELL]: chromeHeadlessShell$1.resolveDownloadPath,
	    [types_js_1.Browser.CHROME]: chrome.resolveDownloadPath,
	    [types_js_1.Browser.CHROMIUM]: chromium$1.resolveDownloadPath,
	    [types_js_1.Browser.FIREFOX]: firefox.resolveDownloadPath,
	};
	exports.executablePathByBrowser = {
	    [types_js_1.Browser.CHROMEDRIVER]: chromedriver$1.relativeExecutablePath,
	    [types_js_1.Browser.CHROMEHEADLESSSHELL]: chromeHeadlessShell$1.relativeExecutablePath,
	    [types_js_1.Browser.CHROME]: chrome.relativeExecutablePath,
	    [types_js_1.Browser.CHROMIUM]: chromium$1.relativeExecutablePath,
	    [types_js_1.Browser.FIREFOX]: firefox.relativeExecutablePath,
	};
	/**
	 * @public
	 */
	async function resolveBuildId(browser, platform, tag) {
	    switch (browser) {
	        case types_js_1.Browser.FIREFOX:
	            switch (tag) {
	                case types_js_1.BrowserTag.LATEST:
	                    return await firefox.resolveBuildId('FIREFOX_NIGHTLY');
	                case types_js_1.BrowserTag.BETA:
	                case types_js_1.BrowserTag.CANARY:
	                case types_js_1.BrowserTag.DEV:
	                case types_js_1.BrowserTag.STABLE:
	                    throw new Error(`${tag} is not supported for ${browser}. Use 'latest' instead.`);
	            }
	        case types_js_1.Browser.CHROME: {
	            switch (tag) {
	                case types_js_1.BrowserTag.LATEST:
	                    return await chrome.resolveBuildId(types_js_1.ChromeReleaseChannel.CANARY);
	                case types_js_1.BrowserTag.BETA:
	                    return await chrome.resolveBuildId(types_js_1.ChromeReleaseChannel.BETA);
	                case types_js_1.BrowserTag.CANARY:
	                    return await chrome.resolveBuildId(types_js_1.ChromeReleaseChannel.CANARY);
	                case types_js_1.BrowserTag.DEV:
	                    return await chrome.resolveBuildId(types_js_1.ChromeReleaseChannel.DEV);
	                case types_js_1.BrowserTag.STABLE:
	                    return await chrome.resolveBuildId(types_js_1.ChromeReleaseChannel.STABLE);
	                default:
	                    const result = await chrome.resolveBuildId(tag);
	                    if (result) {
	                        return result;
	                    }
	            }
	            return tag;
	        }
	        case types_js_1.Browser.CHROMEDRIVER: {
	            switch (tag) {
	                case types_js_1.BrowserTag.LATEST:
	                case types_js_1.BrowserTag.CANARY:
	                    return await chromedriver$1.resolveBuildId(types_js_1.ChromeReleaseChannel.CANARY);
	                case types_js_1.BrowserTag.BETA:
	                    return await chromedriver$1.resolveBuildId(types_js_1.ChromeReleaseChannel.BETA);
	                case types_js_1.BrowserTag.DEV:
	                    return await chromedriver$1.resolveBuildId(types_js_1.ChromeReleaseChannel.DEV);
	                case types_js_1.BrowserTag.STABLE:
	                    return await chromedriver$1.resolveBuildId(types_js_1.ChromeReleaseChannel.STABLE);
	                default:
	                    const result = await chromedriver$1.resolveBuildId(tag);
	                    if (result) {
	                        return result;
	                    }
	            }
	            return tag;
	        }
	        case types_js_1.Browser.CHROMEHEADLESSSHELL: {
	            switch (tag) {
	                case types_js_1.BrowserTag.LATEST:
	                case types_js_1.BrowserTag.CANARY:
	                    return await chromeHeadlessShell$1.resolveBuildId(types_js_1.ChromeReleaseChannel.CANARY);
	                case types_js_1.BrowserTag.BETA:
	                    return await chromeHeadlessShell$1.resolveBuildId(types_js_1.ChromeReleaseChannel.BETA);
	                case types_js_1.BrowserTag.DEV:
	                    return await chromeHeadlessShell$1.resolveBuildId(types_js_1.ChromeReleaseChannel.DEV);
	                case types_js_1.BrowserTag.STABLE:
	                    return await chromeHeadlessShell$1.resolveBuildId(types_js_1.ChromeReleaseChannel.STABLE);
	                default:
	                    const result = await chromeHeadlessShell$1.resolveBuildId(tag);
	                    if (result) {
	                        return result;
	                    }
	            }
	            return tag;
	        }
	        case types_js_1.Browser.CHROMIUM:
	            switch (tag) {
	                case types_js_1.BrowserTag.LATEST:
	                    return await chromium$1.resolveBuildId(platform);
	                case types_js_1.BrowserTag.BETA:
	                case types_js_1.BrowserTag.CANARY:
	                case types_js_1.BrowserTag.DEV:
	                case types_js_1.BrowserTag.STABLE:
	                    throw new Error(`${tag} is not supported for ${browser}. Use 'latest' instead.`);
	            }
	    }
	    // We assume the tag is the buildId if it didn't match any keywords.
	    return tag;
	}
	exports.resolveBuildId = resolveBuildId;
	/**
	 * @public
	 */
	async function createProfile(browser, opts) {
	    switch (browser) {
	        case types_js_1.Browser.FIREFOX:
	            return await firefox.createProfile(opts);
	        case types_js_1.Browser.CHROME:
	        case types_js_1.Browser.CHROMIUM:
	            throw new Error(`Profile creation is not support for ${browser} yet`);
	    }
	}
	exports.createProfile = createProfile;
	/**
	 * @public
	 */
	function resolveSystemExecutablePath(browser, platform, channel) {
	    switch (browser) {
	        case types_js_1.Browser.CHROMEDRIVER:
	        case types_js_1.Browser.CHROMEHEADLESSSHELL:
	        case types_js_1.Browser.FIREFOX:
	        case types_js_1.Browser.CHROMIUM:
	            throw new Error(`System browser detection is not supported for ${browser} yet.`);
	        case types_js_1.Browser.CHROME:
	            return chrome.resolveSystemExecutablePath(platform, channel);
	    }
	}
	exports.resolveSystemExecutablePath = resolveSystemExecutablePath;
	
} (browserData));

var Cache = {};

var hasRequiredCache;

function requireCache () {
	if (hasRequiredCache) return Cache;
	hasRequiredCache = 1;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(Cache, "__esModule", { value: true });
	Cache.Cache = Cache.InstalledBrowser = void 0;
	const fs_1 = __importDefault(require$$0);
	const path_1 = __importDefault(require$$0$1);
	const browser_data_js_1 = browserData;
	const launch_js_1 = requireLaunch();
	/**
	 * @public
	 */
	class InstalledBrowser {
	    browser;
	    buildId;
	    platform;
	    #cache;
	    /**
	     * @internal
	     */
	    constructor(cache, browser, buildId, platform) {
	        this.#cache = cache;
	        this.browser = browser;
	        this.buildId = buildId;
	        this.platform = platform;
	    }
	    /**
	     * Path to the root of the installation folder. Use
	     * {@link computeExecutablePath} to get the path to the executable binary.
	     */
	    get path() {
	        return this.#cache.installationDir(this.browser, this.platform, this.buildId);
	    }
	    get executablePath() {
	        return (0, launch_js_1.computeExecutablePath)({
	            cacheDir: this.#cache.rootDir,
	            platform: this.platform,
	            browser: this.browser,
	            buildId: this.buildId,
	        });
	    }
	}
	Cache.InstalledBrowser = InstalledBrowser;
	/**
	 * The cache used by Puppeteer relies on the following structure:
	 *
	 * - rootDir
	 *   -- <browser1> | browserRoot(browser1)
	 *   ---- <platform>-<buildId> | installationDir()
	 *   ------ the browser-platform-buildId
	 *   ------ specific structure.
	 *   -- <browser2> | browserRoot(browser2)
	 *   ---- <platform>-<buildId> | installationDir()
	 *   ------ the browser-platform-buildId
	 *   ------ specific structure.
	 *   @internal
	 */
	let Cache$1 = class Cache {
	    #rootDir;
	    constructor(rootDir) {
	        this.#rootDir = rootDir;
	    }
	    /**
	     * @internal
	     */
	    get rootDir() {
	        return this.#rootDir;
	    }
	    browserRoot(browser) {
	        return path_1.default.join(this.#rootDir, browser);
	    }
	    installationDir(browser, platform, buildId) {
	        return path_1.default.join(this.browserRoot(browser), `${platform}-${buildId}`);
	    }
	    clear() {
	        fs_1.default.rmSync(this.#rootDir, {
	            force: true,
	            recursive: true,
	            maxRetries: 10,
	            retryDelay: 500,
	        });
	    }
	    uninstall(browser, platform, buildId) {
	        fs_1.default.rmSync(this.installationDir(browser, platform, buildId), {
	            force: true,
	            recursive: true,
	            maxRetries: 10,
	            retryDelay: 500,
	        });
	    }
	    getInstalledBrowsers() {
	        if (!fs_1.default.existsSync(this.#rootDir)) {
	            return [];
	        }
	        const types = fs_1.default.readdirSync(this.#rootDir);
	        const browsers = types.filter((t) => {
	            return Object.values(browser_data_js_1.Browser).includes(t);
	        });
	        return browsers.flatMap(browser => {
	            const files = fs_1.default.readdirSync(this.browserRoot(browser));
	            return files
	                .map(file => {
	                const result = parseFolderPath(path_1.default.join(this.browserRoot(browser), file));
	                if (!result) {
	                    return null;
	                }
	                return new InstalledBrowser(this, browser, result.buildId, result.platform);
	            })
	                .filter((item) => {
	                return item !== null;
	            });
	        });
	    }
	};
	Cache.Cache = Cache$1;
	function parseFolderPath(folderPath) {
	    const name = path_1.default.basename(folderPath);
	    const splits = name.split('-');
	    if (splits.length !== 2) {
	        return;
	    }
	    const [platform, buildId] = splits;
	    if (!buildId || !platform) {
	        return;
	    }
	    return { platform, buildId };
	}
	
	return Cache;
}

var debug = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault$4 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(debug, "__esModule", { value: true });
debug.debug = void 0;
const debug_1 = __importDefault$4(require$$0$2);
debug.debug = debug_1.default;

var detectPlatform = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault$3 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(detectPlatform, "__esModule", { value: true });
detectPlatform.detectBrowserPlatform = void 0;
const os_1$1 = __importDefault$3(require$$0$3);
const browser_data_js_1$2 = browserData;
/**
 * @public
 */
function detectBrowserPlatform() {
    const platform = os_1$1.default.platform();
    switch (platform) {
        case 'darwin':
            return os_1$1.default.arch() === 'arm64'
                ? browser_data_js_1$2.BrowserPlatform.MAC_ARM
                : browser_data_js_1$2.BrowserPlatform.MAC;
        case 'linux':
            return browser_data_js_1$2.BrowserPlatform.LINUX;
        case 'win32':
            return os_1$1.default.arch() === 'x64' ||
                // Windows 11 for ARM supports x64 emulation
                (os_1$1.default.arch() === 'arm64' && isWindows11(os_1$1.default.release()))
                ? browser_data_js_1$2.BrowserPlatform.WIN64
                : browser_data_js_1$2.BrowserPlatform.WIN32;
        default:
            return undefined;
    }
}
detectPlatform.detectBrowserPlatform = detectBrowserPlatform;
/**
 * Windows 11 is identified by the version 10.0.22000 or greater
 * @internal
 */
function isWindows11(version) {
    const parts = version.split('.');
    if (parts.length > 2) {
        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);
        const patch = parseInt(parts[2], 10);
        return (major > 10 ||
            (major === 10 && minor > 0) ||
            (major === 10 && minor === 0 && patch >= 22000));
    }
    return false;
}

var hasRequiredLaunch;

function requireLaunch () {
	if (hasRequiredLaunch) return launch;
	hasRequiredLaunch = 1;
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(launch, "__esModule", { value: true });
	launch.TimeoutError = launch.isErrnoException = launch.isErrorLike = launch.Process = launch.WEBDRIVER_BIDI_WEBSOCKET_ENDPOINT_REGEX = launch.CDP_WEBSOCKET_ENDPOINT_REGEX = launch.launch = launch.computeSystemExecutablePath = launch.computeExecutablePath = void 0;
	const child_process_1 = __importDefault(require$$0$4);
	const fs_1 = require$$0;
	const os_1 = __importDefault(require$$0$3);
	const path_1 = __importDefault(require$$0$1);
	const readline_1 = __importDefault(require$$4$1);
	const browser_data_js_1 = browserData;
	const Cache_js_1 = requireCache();
	const debug_js_1 = debug;
	const detectPlatform_js_1 = detectPlatform;
	const debugLaunch = (0, debug_js_1.debug)('puppeteer:browsers:launcher');
	/**
	 * @public
	 */
	function computeExecutablePath(options) {
	    options.platform ??= (0, detectPlatform_js_1.detectBrowserPlatform)();
	    if (!options.platform) {
	        throw new Error(`Cannot download a binary for the provided platform: ${os_1.default.platform()} (${os_1.default.arch()})`);
	    }
	    const installationDir = new Cache_js_1.Cache(options.cacheDir).installationDir(options.browser, options.platform, options.buildId);
	    return path_1.default.join(installationDir, browser_data_js_1.executablePathByBrowser[options.browser](options.platform, options.buildId));
	}
	launch.computeExecutablePath = computeExecutablePath;
	/**
	 * @public
	 */
	function computeSystemExecutablePath(options) {
	    options.platform ??= (0, detectPlatform_js_1.detectBrowserPlatform)();
	    if (!options.platform) {
	        throw new Error(`Cannot download a binary for the provided platform: ${os_1.default.platform()} (${os_1.default.arch()})`);
	    }
	    const path = (0, browser_data_js_1.resolveSystemExecutablePath)(options.browser, options.platform, options.channel);
	    try {
	        (0, fs_1.accessSync)(path);
	    }
	    catch (error) {
	        throw new Error(`Could not find Google Chrome executable for channel '${options.channel}' at '${path}'.`);
	    }
	    return path;
	}
	launch.computeSystemExecutablePath = computeSystemExecutablePath;
	/**
	 * @public
	 */
	function launch$1(opts) {
	    return new Process(opts);
	}
	launch.launch = launch$1;
	/**
	 * @public
	 */
	launch.CDP_WEBSOCKET_ENDPOINT_REGEX = /^DevTools listening on (ws:\/\/.*)$/;
	/**
	 * @public
	 */
	launch.WEBDRIVER_BIDI_WEBSOCKET_ENDPOINT_REGEX = /^WebDriver BiDi listening on (ws:\/\/.*)$/;
	/**
	 * @public
	 */
	class Process {
	    #executablePath;
	    #args;
	    #browserProcess;
	    #exited = false;
	    // The browser process can be closed externally or from the driver process. We
	    // need to invoke the hooks only once though but we don't know how many times
	    // we will be invoked.
	    #hooksRan = false;
	    #onExitHook = async () => { };
	    #browserProcessExiting;
	    constructor(opts) {
	        this.#executablePath = opts.executablePath;
	        this.#args = opts.args ?? [];
	        opts.pipe ??= false;
	        opts.dumpio ??= false;
	        opts.handleSIGINT ??= true;
	        opts.handleSIGTERM ??= true;
	        opts.handleSIGHUP ??= true;
	        // On non-windows platforms, `detached: true` makes child process a
	        // leader of a new process group, making it possible to kill child
	        // process tree with `.kill(-pid)` command. @see
	        // https://nodejs.org/api/child_process.html#child_process_options_detached
	        opts.detached ??= process.platform !== 'win32';
	        const stdio = this.#configureStdio({
	            pipe: opts.pipe,
	            dumpio: opts.dumpio,
	        });
	        debugLaunch(`Launching ${this.#executablePath} ${this.#args.join(' ')}`, {
	            detached: opts.detached,
	            env: opts.env,
	            stdio,
	        });
	        this.#browserProcess = child_process_1.default.spawn(this.#executablePath, this.#args, {
	            detached: opts.detached,
	            env: opts.env,
	            stdio,
	        });
	        debugLaunch(`Launched ${this.#browserProcess.pid}`);
	        if (opts.dumpio) {
	            this.#browserProcess.stderr?.pipe(process.stderr);
	            this.#browserProcess.stdout?.pipe(process.stdout);
	        }
	        process.on('exit', this.#onDriverProcessExit);
	        if (opts.handleSIGINT) {
	            process.on('SIGINT', this.#onDriverProcessSignal);
	        }
	        if (opts.handleSIGTERM) {
	            process.on('SIGTERM', this.#onDriverProcessSignal);
	        }
	        if (opts.handleSIGHUP) {
	            process.on('SIGHUP', this.#onDriverProcessSignal);
	        }
	        if (opts.onExit) {
	            this.#onExitHook = opts.onExit;
	        }
	        this.#browserProcessExiting = new Promise((resolve, reject) => {
	            this.#browserProcess.once('exit', async () => {
	                debugLaunch(`Browser process ${this.#browserProcess.pid} onExit`);
	                this.#clearListeners();
	                this.#exited = true;
	                try {
	                    await this.#runHooks();
	                }
	                catch (err) {
	                    reject(err);
	                    return;
	                }
	                resolve();
	            });
	        });
	    }
	    async #runHooks() {
	        if (this.#hooksRan) {
	            return;
	        }
	        this.#hooksRan = true;
	        await this.#onExitHook();
	    }
	    get nodeProcess() {
	        return this.#browserProcess;
	    }
	    #configureStdio(opts) {
	        if (opts.pipe) {
	            if (opts.dumpio) {
	                return ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'];
	            }
	            else {
	                return ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'];
	            }
	        }
	        else {
	            if (opts.dumpio) {
	                return ['pipe', 'pipe', 'pipe'];
	            }
	            else {
	                return ['pipe', 'ignore', 'pipe'];
	            }
	        }
	    }
	    #clearListeners() {
	        process.off('exit', this.#onDriverProcessExit);
	        process.off('SIGINT', this.#onDriverProcessSignal);
	        process.off('SIGTERM', this.#onDriverProcessSignal);
	        process.off('SIGHUP', this.#onDriverProcessSignal);
	    }
	    #onDriverProcessExit = (_code) => {
	        this.kill();
	    };
	    #onDriverProcessSignal = (signal) => {
	        switch (signal) {
	            case 'SIGINT':
	                this.kill();
	                process.exit(130);
	            case 'SIGTERM':
	            case 'SIGHUP':
	                void this.close();
	                break;
	        }
	    };
	    async close() {
	        await this.#runHooks();
	        if (!this.#exited) {
	            this.kill();
	        }
	        return await this.#browserProcessExiting;
	    }
	    hasClosed() {
	        return this.#browserProcessExiting;
	    }
	    kill() {
	        debugLaunch(`Trying to kill ${this.#browserProcess.pid}`);
	        // If the process failed to launch (for example if the browser executable path
	        // is invalid), then the process does not get a pid assigned. A call to
	        // `proc.kill` would error, as the `pid` to-be-killed can not be found.
	        if (this.#browserProcess &&
	            this.#browserProcess.pid &&
	            pidExists(this.#browserProcess.pid)) {
	            try {
	                debugLaunch(`Browser process ${this.#browserProcess.pid} exists`);
	                if (process.platform === 'win32') {
	                    try {
	                        child_process_1.default.execSync(`taskkill /pid ${this.#browserProcess.pid} /T /F`);
	                    }
	                    catch (error) {
	                        debugLaunch(`Killing ${this.#browserProcess.pid} using taskkill failed`, error);
	                        // taskkill can fail to kill the process e.g. due to missing permissions.
	                        // Let's kill the process via Node API. This delays killing of all child
	                        // processes of `this.proc` until the main Node.js process dies.
	                        this.#browserProcess.kill();
	                    }
	                }
	                else {
	                    // on linux the process group can be killed with the group id prefixed with
	                    // a minus sign. The process group id is the group leader's pid.
	                    const processGroupId = -this.#browserProcess.pid;
	                    try {
	                        process.kill(processGroupId, 'SIGKILL');
	                    }
	                    catch (error) {
	                        debugLaunch(`Killing ${this.#browserProcess.pid} using process.kill failed`, error);
	                        // Killing the process group can fail due e.g. to missing permissions.
	                        // Let's kill the process via Node API. This delays killing of all child
	                        // processes of `this.proc` until the main Node.js process dies.
	                        this.#browserProcess.kill('SIGKILL');
	                    }
	                }
	            }
	            catch (error) {
	                throw new Error(`${PROCESS_ERROR_EXPLANATION}\nError cause: ${isErrorLike(error) ? error.stack : error}`);
	            }
	        }
	        this.#clearListeners();
	    }
	    waitForLineOutput(regex, timeout = 0) {
	        if (!this.#browserProcess.stderr) {
	            throw new Error('`browserProcess` does not have stderr.');
	        }
	        const rl = readline_1.default.createInterface(this.#browserProcess.stderr);
	        let stderr = '';
	        return new Promise((resolve, reject) => {
	            rl.on('line', onLine);
	            rl.on('close', onClose);
	            this.#browserProcess.on('exit', onClose);
	            this.#browserProcess.on('error', onClose);
	            const timeoutId = timeout > 0 ? setTimeout(onTimeout, timeout) : undefined;
	            const cleanup = () => {
	                if (timeoutId) {
	                    clearTimeout(timeoutId);
	                }
	                rl.off('line', onLine);
	                rl.off('close', onClose);
	                this.#browserProcess.off('exit', onClose);
	                this.#browserProcess.off('error', onClose);
	            };
	            function onClose(error) {
	                cleanup();
	                reject(new Error([
	                    `Failed to launch the browser process!${error ? ' ' + error.message : ''}`,
	                    stderr,
	                    '',
	                    'TROUBLESHOOTING: https://pptr.dev/troubleshooting',
	                    '',
	                ].join('\n')));
	            }
	            function onTimeout() {
	                cleanup();
	                reject(new TimeoutError(`Timed out after ${timeout} ms while waiting for the WS endpoint URL to appear in stdout!`));
	            }
	            function onLine(line) {
	                stderr += line + '\n';
	                const match = line.match(regex);
	                if (!match) {
	                    return;
	                }
	                cleanup();
	                // The RegExp matches, so this will obviously exist.
	                resolve(match[1]);
	            }
	        });
	    }
	}
	launch.Process = Process;
	const PROCESS_ERROR_EXPLANATION = `Puppeteer was unable to kill the process which ran the browser binary.
This means that, on future Puppeteer launches, Puppeteer might not be able to launch the browser.
Please check your open processes and ensure that the browser processes that Puppeteer launched have been killed.
If you think this is a bug, please report it on the Puppeteer issue tracker.`;
	/**
	 * @internal
	 */
	function pidExists(pid) {
	    try {
	        return process.kill(pid, 0);
	    }
	    catch (error) {
	        if (isErrnoException(error)) {
	            if (error.code && error.code === 'ESRCH') {
	                return false;
	            }
	        }
	        throw error;
	    }
	}
	/**
	 * @internal
	 */
	function isErrorLike(obj) {
	    return (typeof obj === 'object' && obj !== null && 'name' in obj && 'message' in obj);
	}
	launch.isErrorLike = isErrorLike;
	/**
	 * @internal
	 */
	function isErrnoException(obj) {
	    return (isErrorLike(obj) &&
	        ('errno' in obj || 'code' in obj || 'path' in obj || 'syscall' in obj));
	}
	launch.isErrnoException = isErrnoException;
	/**
	 * @public
	 */
	class TimeoutError extends Error {
	    /**
	     * @internal
	     */
	    constructor(message) {
	        super(message);
	        this.name = this.constructor.name;
	        Error.captureStackTrace(this, this.constructor);
	    }
	}
	launch.TimeoutError = TimeoutError;
	
	return launch;
}

var install$1 = {};

var fileUtil = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding$1 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault$1 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar$1 = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding$1(result, mod, k);
    __setModuleDefault$1(result, mod);
    return result;
};
var __importDefault$2 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(fileUtil, "__esModule", { value: true });
fileUtil.unpackArchive = void 0;
const child_process_1 = require$$0$4;
const fs_1$1 = require$$0;
const promises_1$1 = require$$2$1;
const path = __importStar$1(require$$0$1);
const util_1 = require$$4$2;
const extract_zip_1 = __importDefault$2(require$$5);
const tar_fs_1 = __importDefault$2(require$$6);
const unbzip2_stream_1 = __importDefault$2(require$$7);
const exec = (0, util_1.promisify)(child_process_1.exec);
/**
 * @internal
 */
async function unpackArchive(archivePath, folderPath) {
    if (archivePath.endsWith('.zip')) {
        await (0, extract_zip_1.default)(archivePath, { dir: folderPath });
    }
    else if (archivePath.endsWith('.tar.bz2')) {
        await extractTar(archivePath, folderPath);
    }
    else if (archivePath.endsWith('.dmg')) {
        await (0, promises_1$1.mkdir)(folderPath);
        await installDMG(archivePath, folderPath);
    }
    else {
        throw new Error(`Unsupported archive format: ${archivePath}`);
    }
}
fileUtil.unpackArchive = unpackArchive;
/**
 * @internal
 */
function extractTar(tarPath, folderPath) {
    return new Promise((fulfill, reject) => {
        const tarStream = tar_fs_1.default.extract(folderPath);
        tarStream.on('error', reject);
        tarStream.on('finish', fulfill);
        const readStream = (0, fs_1$1.createReadStream)(tarPath);
        readStream.pipe((0, unbzip2_stream_1.default)()).pipe(tarStream);
    });
}
/**
 * @internal
 */
async function installDMG(dmgPath, folderPath) {
    const { stdout } = await exec(`hdiutil attach -nobrowse -noautoopen "${dmgPath}"`);
    const volumes = stdout.match(/\/Volumes\/(.*)/m);
    if (!volumes) {
        throw new Error(`Could not find volume path in ${stdout}`);
    }
    const mountPath = volumes[0];
    try {
        const fileNames = await (0, promises_1$1.readdir)(mountPath);
        const appName = fileNames.find(item => {
            return typeof item === 'string' && item.endsWith('.app');
        });
        if (!appName) {
            throw new Error(`Cannot find app in ${mountPath}`);
        }
        const mountedPath = path.join(mountPath, appName);
        await exec(`cp -R "${mountedPath}" "${folderPath}"`);
    }
    finally {
        await exec(`hdiutil detach "${mountPath}" -quiet`);
    }
}

/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __importDefault$1 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(install$1, "__esModule", { value: true });
install$1.canDownload = install$1.getInstalledBrowsers = install$1.uninstall = install$1.install = void 0;
const assert_1 = __importDefault$1(require$$0$5);
const fs_1 = require$$0;
const promises_1 = require$$2$1;
const os_1 = __importDefault$1(require$$0$3);
const path_1 = __importDefault$1(require$$0$1);
const browser_data_js_1$1 = browserData;
const Cache_js_1$1 = requireCache();
const debug_js_1 = debug;
const detectPlatform_js_1$1 = detectPlatform;
const fileUtil_js_1 = fileUtil;
const httpUtil_js_1 = httpUtil;
const debugInstall = (0, debug_js_1.debug)('puppeteer:browsers:install');
const times = new Map();
function debugTime(label) {
    times.set(label, process.hrtime());
}
function debugTimeEnd(label) {
    const end = process.hrtime();
    const start = times.get(label);
    if (!start) {
        return;
    }
    const duration = end[0] * 1000 + end[1] / 1e6 - (start[0] * 1000 + start[1] / 1e6); // calculate duration in milliseconds
    debugInstall(`Duration for ${label}: ${duration}ms`);
}
async function install(options) {
    options.platform ??= (0, detectPlatform_js_1$1.detectBrowserPlatform)();
    options.unpack ??= true;
    if (!options.platform) {
        throw new Error(`Cannot download a binary for the provided platform: ${os_1.default.platform()} (${os_1.default.arch()})`);
    }
    const url = getDownloadUrl(options.browser, options.platform, options.buildId, options.baseUrl);
    const fileName = url.toString().split('/').pop();
    (0, assert_1.default)(fileName, `A malformed download URL was found: ${url}.`);
    const cache = new Cache_js_1$1.Cache(options.cacheDir);
    const browserRoot = cache.browserRoot(options.browser);
    const archivePath = path_1.default.join(browserRoot, `${options.buildId}-${fileName}`);
    if (!(0, fs_1.existsSync)(browserRoot)) {
        await (0, promises_1.mkdir)(browserRoot, { recursive: true });
    }
    if (!options.unpack) {
        if ((0, fs_1.existsSync)(archivePath)) {
            return archivePath;
        }
        debugInstall(`Downloading binary from ${url}`);
        debugTime('download');
        await (0, httpUtil_js_1.downloadFile)(url, archivePath, options.downloadProgressCallback);
        debugTimeEnd('download');
        return archivePath;
    }
    const outputPath = cache.installationDir(options.browser, options.platform, options.buildId);
    if ((0, fs_1.existsSync)(outputPath)) {
        return new Cache_js_1$1.InstalledBrowser(cache, options.browser, options.buildId, options.platform);
    }
    try {
        debugInstall(`Downloading binary from ${url}`);
        try {
            debugTime('download');
            await (0, httpUtil_js_1.downloadFile)(url, archivePath, options.downloadProgressCallback);
        }
        finally {
            debugTimeEnd('download');
        }
        debugInstall(`Installing ${archivePath} to ${outputPath}`);
        try {
            debugTime('extract');
            await (0, fileUtil_js_1.unpackArchive)(archivePath, outputPath);
        }
        finally {
            debugTimeEnd('extract');
        }
    }
    finally {
        if ((0, fs_1.existsSync)(archivePath)) {
            await (0, promises_1.unlink)(archivePath);
        }
    }
    return new Cache_js_1$1.InstalledBrowser(cache, options.browser, options.buildId, options.platform);
}
install$1.install = install;
/**
 *
 * @public
 */
async function uninstall(options) {
    options.platform ??= (0, detectPlatform_js_1$1.detectBrowserPlatform)();
    if (!options.platform) {
        throw new Error(`Cannot detect the browser platform for: ${os_1.default.platform()} (${os_1.default.arch()})`);
    }
    new Cache_js_1$1.Cache(options.cacheDir).uninstall(options.browser, options.platform, options.buildId);
}
install$1.uninstall = uninstall;
/**
 * Returns metadata about browsers installed in the cache directory.
 *
 * @public
 */
async function getInstalledBrowsers(options) {
    return new Cache_js_1$1.Cache(options.cacheDir).getInstalledBrowsers();
}
install$1.getInstalledBrowsers = getInstalledBrowsers;
/**
 * @public
 */
async function canDownload(options) {
    options.platform ??= (0, detectPlatform_js_1$1.detectBrowserPlatform)();
    if (!options.platform) {
        throw new Error(`Cannot download a binary for the provided platform: ${os_1.default.platform()} (${os_1.default.arch()})`);
    }
    return await (0, httpUtil_js_1.headHttpRequest)(getDownloadUrl(options.browser, options.platform, options.buildId, options.baseUrl));
}
install$1.canDownload = canDownload;
function getDownloadUrl(browser, platform, buildId, baseUrl) {
    return new URL(browser_data_js_1$1.downloadUrls[browser](platform, buildId, baseUrl));
}

var CLI$1 = {};

/**
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(CLI$1, "__esModule", { value: true });
CLI$1.makeProgressCallback = CLI$1.CLI = void 0;
const process_1 = require$$0$6;
const readline = __importStar(require$$4$1);
const progress_1 = __importDefault(require$$2$2);
const helpers_1 = require$$3$1;
const yargs_1 = __importDefault(require$$4$3);
const browser_data_js_1 = browserData;
const Cache_js_1 = requireCache();
const detectPlatform_js_1 = detectPlatform;
const install_js_1 = install$1;
const launch_js_1 = requireLaunch();
/**
 * @public
 */
class CLI {
    #cachePath;
    #rl;
    constructor(cachePath = process.cwd(), rl) {
        this.#cachePath = cachePath;
        this.#rl = rl;
    }
    #defineBrowserParameter(yargs) {
        yargs.positional('browser', {
            description: 'Which browser to install <browser>[@<buildId|latest>]. `latest` will try to find the latest available build. `buildId` is a browser-specific identifier such as a version or a revision.',
            type: 'string',
            coerce: (opt) => {
                return {
                    name: this.#parseBrowser(opt),
                    buildId: this.#parseBuildId(opt),
                };
            },
        });
    }
    #definePlatformParameter(yargs) {
        yargs.option('platform', {
            type: 'string',
            desc: 'Platform that the binary needs to be compatible with.',
            choices: Object.values(browser_data_js_1.BrowserPlatform),
            defaultDescription: 'Auto-detected',
        });
    }
    #definePathParameter(yargs, required = false) {
        yargs.option('path', {
            type: 'string',
            desc: 'Path to the root folder for the browser downloads and installation. The installation folder structure is compatible with the cache structure used by Puppeteer.',
            defaultDescription: 'Current working directory',
            ...(required ? {} : { default: process.cwd() }),
        });
        if (required) {
            yargs.demandOption('path');
        }
    }
    async run(argv) {
        const yargsInstance = (0, yargs_1.default)((0, helpers_1.hideBin)(argv));
        await yargsInstance
            .scriptName('@puppeteer/browsers')
            .command('install <browser>', 'Download and install the specified browser. If successful, the command outputs the actual browser buildId that was installed and the absolute path to the browser executable (format: <browser>@<buildID> <path>).', yargs => {
            this.#defineBrowserParameter(yargs);
            this.#definePlatformParameter(yargs);
            this.#definePathParameter(yargs);
            yargs.option('base-url', {
                type: 'string',
                desc: 'Base URL to download from',
            });
            yargs.example('$0 install chrome', 'Install the latest available build of the Chrome browser.');
            yargs.example('$0 install chrome@latest', 'Install the latest available build for the Chrome browser.');
            yargs.example('$0 install chrome@canary', 'Install the latest available build for the Chrome Canary browser.');
            yargs.example('$0 install chrome@115', 'Install the latest available build for Chrome 115.');
            yargs.example('$0 install chromedriver@canary', 'Install the latest available build for ChromeDriver Canary.');
            yargs.example('$0 install chromedriver@115', 'Install the latest available build for ChromeDriver 115.');
            yargs.example('$0 install chromedriver@115.0.5790', 'Install the latest available patch (115.0.5790.X) build for ChromeDriver.');
            yargs.example('$0 install chrome-headless-shell', 'Install the latest available chrome-headless-shell build.');
            yargs.example('$0 install chrome-headless-shell@beta', 'Install the latest available chrome-headless-shell build corresponding to the Beta channel.');
            yargs.example('$0 install chrome-headless-shell@118', 'Install the latest available chrome-headless-shell 118 build.');
            yargs.example('$0 install chromium@1083080', 'Install the revision 1083080 of the Chromium browser.');
            yargs.example('$0 install firefox', 'Install the latest available build of the Firefox browser.');
            yargs.example('$0 install firefox --platform mac', 'Install the latest Mac (Intel) build of the Firefox browser.');
            yargs.example('$0 install firefox --path /tmp/my-browser-cache', 'Install to the specified cache directory.');
        }, async (argv) => {
            const args = argv;
            args.platform ??= (0, detectPlatform_js_1.detectBrowserPlatform)();
            if (!args.platform) {
                throw new Error(`Could not resolve the current platform`);
            }
            args.browser.buildId = await (0, browser_data_js_1.resolveBuildId)(args.browser.name, args.platform, args.browser.buildId);
            await (0, install_js_1.install)({
                browser: args.browser.name,
                buildId: args.browser.buildId,
                platform: args.platform,
                cacheDir: args.path ?? this.#cachePath,
                downloadProgressCallback: makeProgressCallback(args.browser.name, args.browser.buildId),
                baseUrl: args.baseUrl,
            });
            console.log(`${args.browser.name}@${args.browser.buildId} ${(0, launch_js_1.computeExecutablePath)({
                browser: args.browser.name,
                buildId: args.browser.buildId,
                cacheDir: args.path ?? this.#cachePath,
                platform: args.platform,
            })}`);
        })
            .command('launch <browser>', 'Launch the specified browser', yargs => {
            this.#defineBrowserParameter(yargs);
            this.#definePlatformParameter(yargs);
            this.#definePathParameter(yargs);
            yargs.option('detached', {
                type: 'boolean',
                desc: 'Detach the child process.',
                default: false,
            });
            yargs.option('system', {
                type: 'boolean',
                desc: 'Search for a browser installed on the system instead of the cache folder.',
                default: false,
            });
            yargs.example('$0 launch chrome@115.0.5790.170', 'Launch Chrome 115.0.5790.170');
            yargs.example('$0 launch firefox@112.0a1', 'Launch the Firefox browser identified by the milestone 112.0a1.');
            yargs.example('$0 launch chrome@115.0.5790.170 --detached', 'Launch the browser but detach the sub-processes.');
            yargs.example('$0 launch chrome@canary --system', 'Try to locate the Canary build of Chrome installed on the system and launch it.');
        }, async (argv) => {
            const args = argv;
            const executablePath = args.system
                ? (0, launch_js_1.computeSystemExecutablePath)({
                    browser: args.browser.name,
                    // TODO: throw an error if not a ChromeReleaseChannel is provided.
                    channel: args.browser.buildId,
                    platform: args.platform,
                })
                : (0, launch_js_1.computeExecutablePath)({
                    browser: args.browser.name,
                    buildId: args.browser.buildId,
                    cacheDir: args.path ?? this.#cachePath,
                    platform: args.platform,
                });
            (0, launch_js_1.launch)({
                executablePath,
                detached: args.detached,
            });
        })
            .command('clear', 'Removes all installed browsers from the specified cache directory', yargs => {
            this.#definePathParameter(yargs, true);
        }, async (argv) => {
            const args = argv;
            const cacheDir = args.path ?? this.#cachePath;
            const rl = this.#rl ?? readline.createInterface({ input: process_1.stdin, output: process_1.stdout });
            rl.question(`Do you want to permanently and recursively delete the content of ${cacheDir} (yes/No)? `, answer => {
                rl.close();
                if (!['y', 'yes'].includes(answer.toLowerCase().trim())) {
                    console.log('Cancelled.');
                    return;
                }
                const cache = new Cache_js_1.Cache(cacheDir);
                cache.clear();
                console.log(`${cacheDir} cleared.`);
            });
        })
            .demandCommand(1)
            .help()
            .wrap(Math.min(120, yargsInstance.terminalWidth()))
            .parse();
    }
    #parseBrowser(version) {
        return version.split('@').shift();
    }
    #parseBuildId(version) {
        const parts = version.split('@');
        return parts.length === 2 ? parts[1] : 'latest';
    }
}
CLI$1.CLI = CLI;
/**
 * @public
 */
function makeProgressCallback(browser, buildId) {
    let progressBar;
    let lastDownloadedBytes = 0;
    return (downloadedBytes, totalBytes) => {
        if (!progressBar) {
            progressBar = new progress_1.default(`Downloading ${browser} r${buildId} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: totalBytes,
            });
        }
        const delta = downloadedBytes - lastDownloadedBytes;
        lastDownloadedBytes = downloadedBytes;
        progressBar.tick(delta);
    };
}
CLI$1.makeProgressCallback = makeProgressCallback;
function toMegabytes(bytes) {
    const mb = bytes / 1000 / 1000;
    return `${Math.round(mb * 10) / 10} MB`;
}

(function (exports) {
	/**
	 * Copyright 2023 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.InstalledBrowser = exports.Cache = exports.makeProgressCallback = exports.CLI = exports.createProfile = exports.ChromeReleaseChannel = exports.BrowserPlatform = exports.Browser = exports.resolveBuildId = exports.detectBrowserPlatform = exports.uninstall = exports.canDownload = exports.getInstalledBrowsers = exports.install = exports.Process = exports.WEBDRIVER_BIDI_WEBSOCKET_ENDPOINT_REGEX = exports.CDP_WEBSOCKET_ENDPOINT_REGEX = exports.TimeoutError = exports.computeSystemExecutablePath = exports.computeExecutablePath = exports.launch = void 0;
	var launch_js_1 = requireLaunch();
	Object.defineProperty(exports, "launch", { enumerable: true, get: function () { return launch_js_1.launch; } });
	Object.defineProperty(exports, "computeExecutablePath", { enumerable: true, get: function () { return launch_js_1.computeExecutablePath; } });
	Object.defineProperty(exports, "computeSystemExecutablePath", { enumerable: true, get: function () { return launch_js_1.computeSystemExecutablePath; } });
	Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return launch_js_1.TimeoutError; } });
	Object.defineProperty(exports, "CDP_WEBSOCKET_ENDPOINT_REGEX", { enumerable: true, get: function () { return launch_js_1.CDP_WEBSOCKET_ENDPOINT_REGEX; } });
	Object.defineProperty(exports, "WEBDRIVER_BIDI_WEBSOCKET_ENDPOINT_REGEX", { enumerable: true, get: function () { return launch_js_1.WEBDRIVER_BIDI_WEBSOCKET_ENDPOINT_REGEX; } });
	Object.defineProperty(exports, "Process", { enumerable: true, get: function () { return launch_js_1.Process; } });
	var install_js_1 = install$1;
	Object.defineProperty(exports, "install", { enumerable: true, get: function () { return install_js_1.install; } });
	Object.defineProperty(exports, "getInstalledBrowsers", { enumerable: true, get: function () { return install_js_1.getInstalledBrowsers; } });
	Object.defineProperty(exports, "canDownload", { enumerable: true, get: function () { return install_js_1.canDownload; } });
	Object.defineProperty(exports, "uninstall", { enumerable: true, get: function () { return install_js_1.uninstall; } });
	var detectPlatform_js_1 = detectPlatform;
	Object.defineProperty(exports, "detectBrowserPlatform", { enumerable: true, get: function () { return detectPlatform_js_1.detectBrowserPlatform; } });
	var browser_data_js_1 = browserData;
	Object.defineProperty(exports, "resolveBuildId", { enumerable: true, get: function () { return browser_data_js_1.resolveBuildId; } });
	Object.defineProperty(exports, "Browser", { enumerable: true, get: function () { return browser_data_js_1.Browser; } });
	Object.defineProperty(exports, "BrowserPlatform", { enumerable: true, get: function () { return browser_data_js_1.BrowserPlatform; } });
	Object.defineProperty(exports, "ChromeReleaseChannel", { enumerable: true, get: function () { return browser_data_js_1.ChromeReleaseChannel; } });
	Object.defineProperty(exports, "createProfile", { enumerable: true, get: function () { return browser_data_js_1.createProfile; } });
	var CLI_js_1 = CLI$1;
	Object.defineProperty(exports, "CLI", { enumerable: true, get: function () { return CLI_js_1.CLI; } });
	Object.defineProperty(exports, "makeProgressCallback", { enumerable: true, get: function () { return CLI_js_1.makeProgressCallback; } });
	var Cache_js_1 = requireCache();
	Object.defineProperty(exports, "Cache", { enumerable: true, get: function () { return Cache_js_1.Cache; } });
	Object.defineProperty(exports, "InstalledBrowser", { enumerable: true, get: function () { return Cache_js_1.InstalledBrowser; } });
	
} (main$1));

var puppeteerBrowsers = /*@__PURE__*/getDefaultExportFromCjs(main$1);

export { puppeteerBrowsers as default };
