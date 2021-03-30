import path from 'path';
import Song from './model/Song';
import Settings from './settings';
import InputManager from './input';
import { Client } from 'discord-rpc';
import Configstore from 'configstore';
import settings from 'electron-settings';
import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, globalShortcut, nativeImage, shell } from 'electron';

const client = new Client({ transport: 'ipc' });
const pkg = require('./../package.json');
const preferences = new Configstore(pkg.name, { 'closeToTray': false, 'minimizeToTray': false });

var tray: Tray;

function createMainWindow() {
    let userAgent: string;
    let splashWindow: BrowserWindow;
    const mainWindow = createWindow(false, 'deezer-preload.js');

    mainWindow.setMenu(null);

    switch (process.platform) {
        case 'linux':
            userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.114 Safari/537.36'
            break;

        case 'darwin':
            userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.114 Safari/537.36'
            break;

        default:
            userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            break;
    }

    mainWindow.loadURL(Settings.url, { userAgent: userAgent });

    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.show();
        splashWindow.close();
        registerShortcutsAndTray(mainWindow);
    });

    mainWindow.on('close', (event: any) => {
        event.preventDefault();

        if (getPreference<boolean>('closeToTray')) mainWindow.hide(); else app.exit();
    });

    mainWindow.on('minimize', () => {
        if (getPreference<boolean>('minimizeToTray')) mainWindow.hide();
    });

    splashWindow = createWindow(true);
    splashWindow.setResizable(false);
    splashWindow.setMaximizable(false);
    splashWindow.setMenu(null);

    splashWindow.loadURL(`file://${__dirname}/view/splash.html`)
}

function createWindow(visibility: boolean, preload?: string) {
    if (preload) {
        return new BrowserWindow({
            width: Settings.windowWidth,
            height: Settings.windowHeight,
            show: visibility,
            title: 'DeezerRPC',
            webPreferences: {
                preload: path.join(__dirname, preload)
            }
        });
    }

    return new BrowserWindow({
        width: Settings.windowWidth,
        height: Settings.windowHeight,
        show: visibility,
        title: 'DeezerRPC'
    });
}

async function registerShortcutsAndTray(mainWindow: BrowserWindow) {
    const input = new InputManager(mainWindow.webContents);

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
                    label: 'Play/Pause',
                    click: () => input.space()
                },
                {
                    type: 'normal',
                    label: 'Next track',
                    click: () => input.shiftRight()
                },
                {
                    type: 'normal',
                    label: 'Previous track',
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
                    click: async (item) => {
                        setPreference('minimizeToTray', item.checked);
                        await settings.set('minimizeToTray', item.checked);
                    }
                },
                {
                    type: 'checkbox',
                    label: 'Close to tray',
                    checked: getPreference<boolean>('closeToTray'),
                    click: async (item) => {
                        setPreference('closeToTray', item.checked);
                        await settings.set('closeToTray', item.checked);
                    }
                },
            ]
        },
        {
            type: 'normal',
            label: `DeezerRPC ${pkg.version}`,
            click: () => shell.openExternal(pkg.homepage)
        },
        { type: 'separator' },
        {
            type: 'normal',
            label: 'Exit',
            click: () => mainWindow.destroy()
        }
    ]);

    tray.setContextMenu(menu);
    app.dock?.setMenu(menu);
    thumbarButton(mainWindow, input);
    tray.setToolTip('No music played yet.');

    tray.on('double-click', () => {
        if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
    });

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

function getPreference<T>(key: string): T {
    return preferences.get(key);
}

function setPreference(key: string, value: any): any {
    return preferences.set(key, value);
}

ipcMain.on('song-changed', (_event, song: Song) => {
    if (!song.artist) song.artist = 'Unknown Artist';

    if (!song.name) song.name = 'Unknown Song';

    if (!song.link) song.link = 'https://www.deezer.com';

    if (song.listening) {
        client.setActivity({
            details: song.name,
            state: song.artist,
            largeImageKey: 'deezer',
            largeImageText: 'DeezerRPC',
            smallImageKey: 'listening',
            smallImageText: 'Listening',
            endTimestamp: song.time,
            buttons: [
                {
                    label: 'Play Song',
                    url: song.link
                }
            ],
            instance: true
        }, process.pid);
    } else {
        client.setActivity({
            details: song.name,
            state: song.artist,
            largeImageKey: 'deezer',
            largeImageText: 'DeezerRPC',
            smallImageKey: 'paused',
            smallImageText: 'Paused',
            instance: true
        }, process.pid);
    }

    tray.setToolTip(`${song.artist} - ${song.name}`);
});

app.on('ready', createMainWindow);

client.login({ clientId: Settings.clientId }).catch((err: any) => {
    dialog.showErrorBox('Rich Presence Login Failed', `Please, verify if your discord app is opened/working and relaunch this application. (${err})`);
});

// Electron's types are so bad
function thumbarButton(w: any, input: any){
    w.setThumbarButtons([
        {
            tooltip: 'Previous track',
            icon: path.join(__dirname, 'assets', 'previous-track.png'),
            click () {
                input.shiftLeft()
            }
        },
        {
            tooltip: 'Play/Pause',
            icon: path.join(__dirname, 'assets', 'play-pause.png'),
            click () {
                input.space()
            }
        },
        {
            tooltip: 'Next track',
            icon: path.join(__dirname, 'assets', 'next-track.png'),
            click () {
                input.shiftRight()
            }
        }
    ]);
}
