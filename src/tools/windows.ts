import {BrowserWindow, Rectangle, screen} from "electron";
import {createProtocol} from "vue-cli-plugin-electron-builder/lib";
import {MessageType, WinOpt, ColorStatus} from "./enums";
import {ModeConfig, RuleName} from "./rule";
import {RouteName} from "./action";
import {loadStyles} from "./style";

class WindowWrapper {
    window: BrowserWindow | undefined = undefined;
    stored: string = RouteName.Focus;

    sendMsg(type: string, msg: any) {
        if (this.window) this.window.webContents.send(type, msg);
    }

    winOpt(type: WinOpt, args: any) {
        this.sendMsg(MessageType.WindowOpt.toString(), {
            type: type,
            args: args
        });
    }

    switchColor(color: ColorStatus) {
        this.winOpt(WinOpt.ChangeColor, color);
    }

    routeTo(routerName: string) {
        if (this.window) {
            this.window.focus();
            this.window.webContents.send(MessageType.Router.toString(), routerName);
        }
    }

    load(routerName: RouteName = RouteName.Focus) {
        if (!this.window) return;
        if (process.env.WEBPACK_DEV_SERVER_URL) {
            // Load the url of the dev server if in development mode
            this.window.loadURL(
                process.env.WEBPACK_DEV_SERVER_URL + `/#/${routerName}`
            );
            if (!process.env.IS_TEST) this.window.webContents.openDevTools();
        } else {
            createProtocol("app");
            // Load the index.html when not in development
            this.window.loadURL(`file://${__dirname}/index.html#${routerName}`);
        }
        let windowPointer = this.window;
        this.window.webContents.on("did-finish-load", function () {
            windowPointer.webContents.insertCSS(loadStyles());
        });
        var that = this;
        this.window.on("blur", () => {
            that.edgeHide();
        });
        this.window.on("focus", () => {
            that.edgeShow();
        })
    }

    setBounds(bounds: Rectangle) {
        if (this.window) {
            this.window.setBounds(bounds);
        }
    }

    edgeHide() {
        let {x, y, width, height} = this.getBound();
        let xEnd = x + width;
        let yEnd = y + height;
        const {
            width: screenWidth,
            height: screenHeight
        } = screen.getPrimaryDisplay().workAreaSize;
        if (
            (x <= 0 || xEnd >= screenWidth || y <= 0) &&
            (<any>global).controller.get(RuleName.autoHide)
        ) {
            if (y <= 0) {
                while (yEnd > 10) {
                    y--;
                    yEnd--;
                    this.setBounds({x: x, y: y, width: width, height: height});
                }
            } else if (x < 0) {
                while (xEnd >= 10) {
                    x--;
                    xEnd--;
                    this.setBounds({x: x, y: y, width: width, height: height});
                }
            } else if (xEnd >= screenWidth) {
                while (x < screenWidth - 10) {
                    x++;
                    this.setBounds({x: x, y: y, width: width, height: height});
                }
            }
        }
    }

    edgeShow() {
        let {x, y, width, height} = this.getBound();
        let xEnd = x + width;
        let yEnd = y + height;
        const {
            width: screenWidth,
            height: screenHeight
        } = screen.getPrimaryDisplay().workAreaSize;
        if (
            (x <= 0 || xEnd >= screenWidth || y <= 0) &&
            (<any>global).controller.get(RuleName.autoHide)
        ) {
            while (x < 0) {
                x++;
                xEnd++;
                this.setBounds({x: x, y: y, width: width, height: height});
            }

            while (xEnd > screenWidth) {
                x--;
                xEnd--;
                this.setBounds({x: x, y: y, width: width, height: height});
            }

            while (y < 0) {
                y++;
                yEnd++;
                this.setBounds({x: x, y: y, width: width, height: height});
            }
        }
    }

    show() {
        if (this.window) {
            if(this.window.isMinimized())
                this.window.restore();
            this.window.focus();
            this.window.moveTop();
        }
    }

    blur() {
        if (this.window) {
            this.window.blur();
        }
    }

    createWindow(param: ModeConfig) {
        // Create the browser window.
        this.window = new BrowserWindow({
            x: param.x,
            y: param.y,
            width: param.width,
            height: param.height,
            frame: false
        });
        this.load();
        this.window.on("closed", () => {
            this.window = undefined;
        });
    }

    getBound(): Rectangle {
        if (this.window) {
            return this.window.getBounds();
        } else {
            return {
                x: 100,
                y: 100,
                width: 800,
                height: 600
            };
        }
    }

    restore(param: ModeConfig) {
        if (this.window) {
            this.window.setBounds(Object.assign(this.getBound(), param));
            this.window.setAlwaysOnTop(
                (<any>global).controller.get(RuleName.stayTop)
            );
        }
    }
}

export {WindowWrapper};
