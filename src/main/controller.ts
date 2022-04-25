import { WindowMangaer } from "./views/manager";
import { eventListener } from "./event-listener";
import { MenuManager } from "./menu-manager";
import { Identifier, authorizeKey } from "../common/types";
import { startService } from "../proxy/main";
import { ShortcutManager } from "./shortcut";
import { app, BrowserWindow } from "electron";
import { env } from "../common/env";
import store, { observers, restoreFromConfig } from "../store";
import { TranslateController } from "./translate-controller";
import { l10n, L10N } from "./l10n";
import actionLinks, { showDragCopyWarning } from "./views/dialog";
import { resetAllConfig } from "./file-related";
import { MainController } from "../common/controller";
import { UpdateChecker } from "./views/update";
import config from "@/common/configuration";
import eventBus from "@/common/event-bus";
import simulate from "./simulate";
import logger from "@/common/logger";

class Controller extends MainController {
  win: WindowMangaer = new WindowMangaer(this);
  menu: MenuManager = new MenuManager(this);
  updater = new UpdateChecker(this);
  shortcut: ShortcutManager = new ShortcutManager();
  l10n: L10N = l10n;
  transCon = new TranslateController(this);

  constructor() {
    super();
    this.config.load(env.configPath);
    observers.push(this);
    observers.push(this.transCon);
    this.bindLinks(actionLinks);
  }

  changeFontSize(increase: boolean) {
    const layoutType = config.get("layoutType");
    const layoutConfig = config.get(layoutType);
    layoutConfig.fontSize += increase ? 1 : -1;
    config.set(layoutType, layoutConfig);
  }

  handle(identifier: Identifier, param: any): boolean {
    switch (identifier) {
      case "font+":
        this.changeFontSize(true);
        break;
      case "font-":
        this.changeFontSize(false);
        break;
      case "exit":
        this.handle("closeWindow", null);
        this.onExit();
        break;
      case "settings":
        this.win.get("settings").show();
        break;
      case "restoreDefault":
        this.resotreDefaultSetting();
        break;
      case "checkUpdate":
        this.updater.check();
        break;
      case "hideWindow":
        this.win.get("contrast").hide();
        break;
      case "closeWindow":
        this.win.close();
        break;
      case "showWindow":
        this.win.showWindow();
        break;
      case "minimize":
        this.win.get("contrast").minimize();
        break;
      case "simulateCopy":
        setTimeout(() => {
          logger.toast("模拟复制");
          simulate.copy();
        }, 100);
        break;
      default:
        return this.transCon.handle(identifier, param);
    }
    return true;
  }

  createWindow() {
    this.l10n.install(store, this.config.get("localeSetting")); //修复无法检测系统语言的问题
    this.transCon.init(); //初始化翻译控制器
    this.restoreFromConfig(); //恢复设置
    eventListener.bind(); //绑定事件
    startService(this, authorizeKey); // 创建代理服务
    this.win.get("contrast"); //创建主窗口
    this.shortcut.init();
    this.menu.init();
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
          showDragCopyWarning(this);
        }
        break;
      case "colorMode":
        BrowserWindow.getAllWindows().forEach((window) => {
          window.reload();
        });
        break;
      case "stayTop":
        this.win.setStayTop(value);
        break;
      case "skipTaskbar":
        this.win.get("contrast").setSkipTaskbar(value);
        break;
      case "openAtLogin":
        app.setLoginItemSettings({
          openAtLogin: value,
        });
        break;
      default:
        return false;
    }
    return true;
  }

  resotreDefaultSetting() {
    resetAllConfig();
    this.config.restoreDefault(env.configPath);
    this.restoreFromConfig();
  }

  restoreFromConfig() {
    restoreFromConfig(observers, store.state.config);
  }
}

export { Controller };
