import { Window } from "../common/views/windows";
import { eventListener } from "./event-listener";
import { MenuManager } from "./menu-manager";
import { recognizer } from "../common/ocr";
import { Identifier, authorizeKey } from "../common/types";
import { startService } from "../proxy/main";
import { ShortcutManager } from "./shortcut";
import { app, BrowserWindow } from "electron";
import { env } from "../common/env";
import store, { observers, restoreFromConfig } from "../store";
import { TranslateController } from "./translate-controller";
import { l10n, L10N } from "./l10n";
import { showSettings, showDragCopyWarning } from "../common/views";
import { MainController } from "../common/controller";
import bus from "@/common/event-bus";

class Controller extends MainController {
  win: Window = new Window();
  menu: MenuManager = new MenuManager(this);
  shortcut: ShortcutManager = new ShortcutManager();
  l10n: L10N = l10n;
  transCon = new TranslateController(this);

  constructor() {
    super();
    this.config.load(env.configPath);
    this.l10n.install(store, this.config.get("localeSetting"));
    observers.push(this);
    observers.push(this.transCon);
  }

  handle(identifier: Identifier): boolean {
    console.log("main handle", identifier);
    switch (identifier) {
      case "font+":
        break;
      case "font-":
        break;
      case "exit":
        this.onExit();
        break;
      case "settings":
        showSettings();
        break;
      case "helpAndUpdate":
        break;
      default:
        return this.transCon.handle(identifier);
    }
    console.log(identifier);
    return true;
  }

  createWindow() {
    restoreFromConfig(observers, store.state.config);
    eventListener.bind();
    startService(this, authorizeKey);
    this.win.createWindow("contrast");
    this.shortcut.init();
    this.menu.init();
    recognizer.setUp();
  }

  onExit() {
    this.config.save(env.configPath);
    this.shortcut.unregister();
    app.exit();
  }

  postSet(identifier: Identifier, value: any): boolean {
    switch (identifier) {
      case "localeSetting":
        this.l10n.updateLocale(this.get("localeSetting"));
        break;
      case "dragCopy":
        if (value == true && !this.get("neverShow")) {
          showDragCopyWarning();
        }
        break;
      case "colorMode":
        BrowserWindow.getAllWindows().forEach(window => {
          window.reload();
        });
        break;
      default:
        return false;
    }
    return true;
  }

  resotreDefaultSetting() {
    this.config.restoreDefault(env.configPath);
    this.restoreFromConfig();
  }

  restoreFromConfig() {
    restoreFromConfig(observers, store.state.config);
  }
}

export { Controller };
