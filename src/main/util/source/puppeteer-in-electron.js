import require$$0 from 'get-port';
import require$$1 from 'http';
import require$$2 from 'async-retry';
import require$$3 from './uuid';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var bin = {};

(function (exports) {
	var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
	    return (mod && mod.__esModule) ? mod : { "default": mod };
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getPage = exports.connect = exports.initialize = void 0;
	const get_port_1 = __importDefault(require$$0);
	const http_1 = __importDefault(require$$1);
	const async_retry_1 = __importDefault(require$$2);
	const uuid_1 = require$$3;
	const readJson = async (port) => new Promise((resolve, reject) => {
	    let json = "";
	    const request = http_1.default.request({
	        host: "127.0.0.1",
	        path: "/json/version",
	        port
	    }, (response) => {
	        response.on("error", reject);
	        response.on("data", (chunk) => {
	            json += chunk.toString();
	        });
	        response.on("end", () => resolve(JSON.parse(json)));
	    });
	    request.on("error", reject);
	    request.end();
	});
	/**
	 * Initialize the electron app to accept puppeteer/DevTools connections.
	 * Must be called at startup before the electron app is ready.
	 * @param {App} app The app imported from electron.
	 * @param {number} port Port to host the DevTools websocket connection.
	 */
	const initialize = async (app, port = 0) => {
	    if (!app) {
	        throw new Error("The parameter 'app' was not passed in. " +
	            "This may indicate that you are running in node rather than electron.");
	    }
	    if (app.isReady()) {
	        throw new Error("Must be called at startup before the electron app is ready.");
	    }
	    if (port < 0 || port > 65535) {
	        throw new Error(`Invalid port ${port}.`);
	    }
	    if (app.commandLine.getSwitchValue("remote-debugging-port")) {
	        throw new Error("The electron application is already listening on a port. Double `initialize`?");
	    }
	    const actualPort = port === 0 ? await get_port_1.default({ host: "127.0.0.1" }) : port;
	    app.commandLine.appendSwitch("remote-debugging-port", `${actualPort}`);
	    app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
	    const electronMajor = parseInt(app.getVersion().split(".")[0], 10);
	    // NetworkService crashes in electron 6.
	    if (electronMajor >= 7) {
	        app.commandLine.appendSwitch("enable-features", "NetworkService");
	    }
	};
	exports.initialize = initialize;
	/**
	 * Connects puppeteer to the electron app. Must call {@link initialize} before connecting.
	 * When connecting multiple times, you use the same port.
	 * @param {App} app The app imported from electron.
	 * @param {puppeteer} puppeteer The imported puppeteer namespace.
	 * @returns {Promise<Browser>} An object containing the puppeteer browser, the port, and json received from DevTools.
	 */
	const connect = async (app, puppeteer) => {
	    if (!puppeteer) {
	        throw new Error("The parameter 'puppeteer' was not passed in.");
	    }
	    const port = app.commandLine.getSwitchValue("remote-debugging-port");
	    if (!port) {
	        throw new Error("The electron application was not setup to listen on a port. Was `initialize` called at startup?");
	    }
	    await app.whenReady;
	    const json = await async_retry_1.default(() => readJson(port));
	    const browser = await puppeteer.connect({
	        browserWSEndpoint: json.webSocketDebuggerUrl,
	        defaultViewport: null
	    });
	    return browser;
	};
	exports.connect = connect;
	/**
	 * Given a BrowserWindow, find the corresponding puppeteer Page. It is undefined if external operations
	 * occur on the page whilst we are attempting to find it. A url/file must be loaded on the window for it to be found.
	 * If no url is loaded, the parameter 'allowBlankNavigate' allows us to load "about:blank" first.
	 * @param {Browser} browser The puppeteer browser instance obtained from calling |connect|.
	 * @param {BrowserWindow} window The browser window for which we want to find the corresponding puppeteer Page.
	 * @param {boolean} allowBlankNavigate If no url is loaded, allow us to load "about:blank" so that we may find the Page.
	 * @returns {Promise<Page>} The page that corresponds with the BrowserWindow.
	 */
	const getPage = async (browser, window, allowBlankNavigate = true) => {
	    if (!browser) {
	        throw new Error("The parameter 'browser' was not passed in.");
	    }
	    if (!window) {
	        throw new Error("The parameter 'window' was not passed in.");
	    }
	    if (window.webContents.getURL() === "") {
	        if (allowBlankNavigate) {
	            await window.webContents.loadURL("about:blank");
	        }
	        else {
	            throw new Error("In order to get the puppeteer Page, we must be able " +
	                "to execute JavaScript which requires the window having loaded a URL.");
	        }
	    }
	    const guid = uuid_1.v4();
	    await window.webContents.executeJavaScript(`window.puppeteer = "${guid}"`);
	    const pages = await browser.pages();
	    const guids = await Promise.all(pages.map(async (testPage) => {
	        try {
	            return await testPage.evaluate("window.puppeteer");
	        }
	        catch (_a) {
	            return undefined;
	        }
	    }));
	    const index = guids.findIndex((testGuid) => testGuid === guid);
	    await window.webContents.executeJavaScript("delete window.puppeteer");
	    const page = pages[index];
	    if (!page) {
	        throw new Error("Unable to find puppeteer Page from BrowserWindow. Please report this.");
	    }
	    return page;
	};
	exports.getPage = getPage;
	exports.default = {
	    connect: exports.connect,
	    getPage: exports.getPage,
	    initialize: exports.initialize
	};
	
} (bin));

var index = /*@__PURE__*/getDefaultExportFromCjs(bin);

export { index as default };
