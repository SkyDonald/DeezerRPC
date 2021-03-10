import path from 'path';
import Song from './model/Song';
import Settings from './settings';
import InputManager from './input';
import { Client } from 'discord-rpc';
import Configstore from 'configstore';
import settings from 'electron-settings';
import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, globalShortcut, nativeImage, shell } from 'electron';

const RPC = new Client({ transport: 'ipc' });
const APP_PACKAGE = require('./../package.json');
const APP_PREFERENCES = new Configstore(APP_PACKAGE.name, { 'closeToTray': false, 'minimizeToTray': false });

var tray: Tray;

// Entry
function createMainWindow() {
    let userAgent: string;
    let splashWindow: BrowserWindow;
    const mainWindow = createWindow(false, 'deezer-preload.js');

    // Disable menu (only works on Windows)
    mainWindow.setMenu(null);

    // User agent
    switch (process.platform) {
        case 'linux':
            userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.114 Safari/537.36'
            break;

        case 'darwin':
            userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.114 Safari/537.36'
            break;

        // win32
        default:
            userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            break;
    }

    mainWindow.loadURL(Settings.DeezerUrl, { userAgent: userAgent });

    // MainWindow
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.show();
        splashWindow.close();
        registerShortcutsAndTray(mainWindow);
    });

    // Events
    mainWindow.on('close', (event: any) => {
        event.preventDefault();

        if (getPreference<boolean>('closeToTray')) mainWindow.hide(); else app.exit();
    });

    mainWindow.on('minimize', () => {
        if (getPreference<boolean>('minimizeToTray')) mainWindow.hide();
    });

    // Splash
    splashWindow = createWindow(true);
    splashWindow.setResizable(false);
    splashWindow.setMaximizable(false);
    splashWindow.setMenu(null);

    splashWindow.loadURL(`file://${__dirname}/view/splash.html`)
}

function createWindow(visibility: boolean, preload?: string) {
    if (preload) {
        return new BrowserWindow({
            width: Settings.WindowWidth,
            height: Settings.WindowHeight,
            show: visibility,
            title: 'DeezerRPC',
            webPreferences: {
                preload: path.join(__dirname, preload)
            }
        });
    }

    return new BrowserWindow({
        width: Settings.WindowWidth,
        height: Settings.WindowHeight,
        show: visibility,
        title: 'DeezerRPC'
    });
}

async function registerShortcutsAndTray(mainWindow: BrowserWindow) {
    const input = new InputManager(mainWindow.webContents);

    // Tray
    const icon = nativeImage.createFromPath(`${__dirname}/assets/icon.png`);

    icon.setTemplateImage(true);

    tray = new Tray(icon);

    const menu = Menu.buildFromTemplate([
        {
            type: 'normal',
            label: 'Toggle',
            click: () => {
                if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
            },
        },
        { type: 'separator' },
        {
            type: 'submenu',
            label: 'Player',
            submenu: [
                {
                    type: 'normal',
                    label: '♪ Play/Pause',
                    click: () => input.space()
                },
                {
                    type: 'normal',
                    label: '→ Next',
                    click: () => input.shiftRight()
                },
                {
                    type: 'normal',
                    label: '← Previous',
                    click: () => input.shiftLeft()
                }
            ]
        },
        { type: 'separator' },
        {
            type: 'submenu',
            label: 'Settings',
            submenu: [
                {
                    type: 'checkbox',
                    label: 'Minimize to tray',
                    checked: getPreference<boolean>('minimizeToTray'),
                    click: async (item: any) => {
                        setPreference('minimizeToTray', item.checked);
                        await settings.set('minimizeToTray', item.checked);
                    }
                },
                {
                    type: 'checkbox',
                    label: 'Close to tray',
                    checked: getPreference<boolean>('closeToTray'),
                    click: async (item: any) => {
                        setPreference('closeToTray', item.checked);
                        await settings.set('closeToTray', item.checked);
                    }
                },
            ]
        },
        {
            type: 'normal',
            label: `DeezerRPC ${APP_PACKAGE.version}`,
            click: () => shell.openExternal(APP_PACKAGE.homepage)
        },
        { type: 'separator' },
        {
            type: 'normal',
            label: 'Exit',
            click: () => mainWindow.destroy()
        }
    ]);

    tray.setContextMenu(menu);
    tray.setToolTip('No music played yet.');

    // Double clicking hide/show
    tray.on('double-click', () => {
        if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
    });

    // Global Shortcuts
    globalShortcut.register('MediaPlayPause', () => {
        input.space();
    });

    globalShortcut.register('MediaPreviousTrack', () => {
        input.shiftLeft();
    });

    globalShortcut.register('MediaNextTrack', () => {
        input.shiftRight();
    });
}

// Preferences
function getPreference<T>(key: string): T {
    return APP_PREFERENCES.get(key);
}

function setPreference(key: string, value: any): any {
    return APP_PREFERENCES.set(key, value);
}

// IPC
ipcMain.on('song-changed', (event: any, song: Song) => {
    if (!song.artist) song.artist = 'Unknown Artist';

    if (!song.name) song.name = 'Unknown Song';

    if (!song.link) song.link = 'https://www.deezer.com';

    if (song.listening) {
        requestPresence(RPC, {
            details: song.name,
            state: song.artist,
            assets: {
                large_image: 'default',
                large_text: 'DeezerRPC',
                small_image: 'listening',
                small_text: 'Listening'
            },
            buttons: [
                {
                    label: 'Play Song',
                    url: song.link
                }
            ],
            timestamps: {
                end: song.time
            },
            instance: true
        });
    } else {
        requestPresence(RPC, {
            details: song.name,
            state: song.artist,
            assets: {
                large_image: 'default',
                large_text: 'DeezerRPC',
                small_image: 'paused',
                small_text: 'Paused'
            },
            buttons: [
                {
                    label: 'Play Song',
                    url: song.link
                }
            ],
            timestamps: {
                end: song.time
            },
            instance: true
        });
    }

    tray.setToolTip(`${song.artist} - ${song.name}`);
});

// App
app.on('ready', createMainWindow);

// Initialize RPC
RPC.login({ clientId: Settings.DiscordClientID }).catch((err: any) => {
    dialog.showErrorBox('Rich Presence Login Failed', `Please, verify if your discord app is opened/working and relaunch this application. (${err})`);
});

// Using this to ignore TypeScript error 'RPC.request is not a function'
function requestPresence(client: any, activity: any) {
    client.request('SET_ACTIVITY', {
        pid: process.pid,
        activity
    });
}
