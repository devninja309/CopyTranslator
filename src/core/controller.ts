import { createTranslator } from "../tools/translators";
import { Translator, TranslateResult } from "@opentranslate/translator";
import { isValid } from "../tools/translators/helper";
import { initConfig } from "../tools/configuration";
import { ConfigParser } from "../tools/configParser";
import { ColorStatus, MessageType, WinOpt } from "../tools/enums";
import { WindowWrapper } from "../tools/views/windows";
import { windowController } from "../tools/windowController";
import simulate from "../tools/simulate";
import { envConfig } from "../tools/envConfig";
import { l10n, L10N } from "../tools/l10n";
import { colorRules, getColorRule } from "../tools/rule";
import { normalizeAppend } from "./stringProcessor";
import { app, Rectangle } from "electron";
import { ActionManager } from "../tools/action";
import { TrayManager } from "../tools/tray";
import { handleActions } from "./actionCallback";
import { checkNotice } from "../tools/checker";
import { checkForUpdates } from "../tools/views/update";
import { recognizer } from "../tools/ocr";
import { Identifier } from "@/tools/identifier";

const clipboard = require("electron-clipboard-extended");

class Controller {
  src: string = "";
  result: string = "";
  res: TranslateResult | undefined;
  lastAppend: string = "";
  win: WindowWrapper = new WindowWrapper();
  translator: Translator = createTranslator("Google");
  config: ConfigParser = initConfig();
  locales: L10N = l10n;
  action = new ActionManager(handleActions);
  tray: TrayManager = new TrayManager();
  translating: boolean = false; //正在翻译

  constructor() {
    this.config.loadValues(envConfig.configPath);
    this.restoreFromConfig();
  }

  public static getInstance(): Controller {
    return (<any>global).controller;
  }

  createWindow() {
    this.tray.init();
    this.win.createWindow(this.get("frameMode"));
    windowController.bind();
    this.action.init();
    recognizer.setUp();
    checkForUpdates();
    checkNotice();
  }
  capture() {
    (<any>global).shortcutCapture.shortcutCapture();
  }
  foldWindow() {
    this.win.edgeHide(this.win.onEdge());
  }
  expandWindow() {
    this.win.edgeShow();
  }

  onExit() {
    this.config.saveValues(envConfig.configPath);
    this.action.unregister();
    app.quit();
  }

  setSrc(append: string) {
    if (this.get("incrementalCopy") && this.src != "")
      this.src = this.src + " " + append;
    else this.src = append;
  }

  get(identifier: Identifier) {
    return this.config.get(identifier);
  }

  resotreDefaultSetting() {
    this.config.restoreDefault(envConfig.configPath);
    this.restoreFromConfig();
  }

  clear() {
    this.src = "";
    this.result = "";
    this.lastAppend = "";
    this.res = undefined;
    this.sync();
  }

  checkClipboard() {
    let originalText = clipboard.readText();
    if (!this.checkLength(originalText)) {
      return;
    }
    let text = normalizeAppend(originalText, this.get("autoPurify"));
    if (this.checkValid(text)) {
      this.doTranslate(text);
    }
  }

  tryTranslate(text: string, clear = false) {
    if (text != "") {
      if (clear) {
        this.clear();
      }
      this.doTranslate(normalizeAppend(text, this.get("autoPurify")));
    }
  }

  getT() {
    return this.locales.getT(this.config.get("localeSetting"));
  }

  onError(msg: string) {
    console.log(msg);
  }

  sync(language: any = undefined) {
    if (!language) {
      language = {
        source: this.source(),
        target: this.target()
      };
    }
    let extra: any = {};
    this.win.sendMsg(
      MessageType.TranslateResult.toString(),
      Object.assign(
        {
          src: this.src,
          result: this.result,
          source: language.source,
          target: language.target,
          engine: this.get("translatorType"),
          notify: this.get("enableNotify")
        },
        extra
      )
    );
  }
  checkLength(text: string) {
    const threshold = 3000;
    if (text.length > threshold || text.length == 0) {
      this.setCurrentColor(true);
      return false;
    } else return true;
  }

  checkValid(text: string) {
    const urlExp = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (!this.checkLength(text)) {
      return false;
    }
    return !(
      urlExp.test(text) ||
      this.result == text ||
      this.src == text ||
      this.lastAppend == text ||
      text == ""
    );
  }

  postProcess(language: any, result: TranslateResult) {
    if (this.get("autoCopy")) {
      clipboard.writeText(this.result);
      if (this.get("autoPaste")) {
        simulate.paste();
      }
    } else if (this.get("autoFormat")) {
      clipboard.writeText(this.src);
    }
    this.setCurrentColor();
    if (this.get("autoShow")) {
      this.win.edgeShow();
      this.win.show(!(this.get("autoCopy") && this.get("autoPaste")));
    }
    this.res = result;
    this.sync(language);
  }

  getOptions() {
    let realOptions = 0;
    for (let item of colorRules.entries()) {
      if (this.get(item[0])) {
        realOptions |= item[1];
      }
    }
    return realOptions;
  }

  setCurrentColor(fail = false) {
    if (fail) {
      this.win.switchColor(ColorStatus.Fail);
      return;
    }
    if (!this.get("listenClipboard")) {
      this.win.switchColor(ColorStatus.None);
      return;
    }
    const options = this.getOptions();
    const incrementalCopy = getColorRule("incrementalCopy");
    const autoCopy = getColorRule("autoCopy");
    const autoPaste = getColorRule("autoPaste");
    switch (options) {
      case incrementalCopy | autoCopy | autoPaste:
        this.win.switchColor(ColorStatus.IncrementalCopyPaste);
        return;
      case incrementalCopy | autoCopy:
        this.win.switchColor(ColorStatus.IncrementalCopy);
        return;
      case incrementalCopy:
        this.win.switchColor(ColorStatus.Incremental);
        return;
      case autoCopy | autoPaste:
        this.win.switchColor(ColorStatus.AutoPaste);
        return;
      case autoCopy:
        this.win.switchColor(ColorStatus.AutoCopy);
        return;
    }
    this.win.switchColor(ColorStatus.Listen);
  }

  async decideLanguage(text: string) {
    let should_src = this.source();
    let dest_lang = this.target();
    let src_lang = should_src;

    if (should_src === "auto") {
      src_lang = should_src;
    } else {
      try {
        let lang = await this.translator.detect(text);
        if (lang) src_lang = lang;
      } catch (e) {
        this.onError(e);
      }
    }

    if (src_lang == dest_lang) {
      if (this.get("smartTranslate")) {
        dest_lang = should_src;
      }
    }

    return {
      source: src_lang,
      target: dest_lang
    };
  }

  preProcess(text: string) {
    this.lastAppend = text;
    this.setSrc(text);
    this.win.switchColor(ColorStatus.Translating);
  }

  setUpRecognizer(APP_ID: string, API_KEY: string, SECRET_KEY: string) {
    this.set("APP_ID", APP_ID, true, false);
    this.set("API_KEY", API_KEY, true, false);
    this.set("SECRET_KEY", SECRET_KEY, true, false);
    recognizer.setUp(true);
  }

  async doTranslate(text: string) {
    if (this.translating || !this.checkLength(text)) {
      //翻译无法被打断
      return;
    }
    this.translating = true;
    const language = await this.decideLanguage(text);
    if (language.source == language.target) {
      return;
    }
    this.preProcess(text);
    this.translator
      .translate(this.src, language.source, language.target)
      .then(res => {
        if (res) {
          const resultString = normalizeAppend(
            res.trans.paragraphs[0],
            this.get("autoPurify")
          );
          this.result = resultString;
          this.postProcess(language, res);
        } else {
          this.onError("translate error");
          this.setCurrentColor(true);
        }
        this.translating = false;
      })
      .catch(err => {
        this.translating = false;
        console.error(err);
      });
  }

  source() {
    return this.get("sourceLanguage");
  }

  target() {
    return this.get("targetLanguage");
  }

  // OCR 相关
  checkImage() {
    recognizer.recognize(clipboard.readImage().toDataURL());
  }

  postProcessImage(words_result: Array<{ words: string }>) {
    let src = words_result.map(item => item["words"]).join("\n");
    this.tryTranslate(src);
  }

  setWatch(watch: boolean) {
    if (watch) {
      clipboard.on("text-changed", () => {
        this.checkClipboard();
      });
      clipboard.on("image-changed", () => {
        this.checkImage();
      });
      clipboard.startWatching();
    } else {
      clipboard.stopWatching();
    }
  }

  saveWindow(routeName: Identifier, bound: Rectangle, fontSize: number) {
    this.set(
      routeName,
      Object.assign(this.get(routeName), bound, {
        fontSize: fontSize
      })
    );
  }

  restoreWindow(routeName: Identifier | undefined) {
    if (routeName) this.win.restore(this.get(routeName));
  }

  restoreFromConfig() {
    for (let key of this.config.values.keys()) {
      this.set(key, this.get(key), false);
    }
  }

  switchValue(identifier: Identifier) {
    this.set(identifier, !this.get(identifier));
  }

  refresh(ruleKey: string | null = null) {
    this.win.winOpt(WinOpt.Refresh, ruleKey);
  }

  set(identifier: Identifier, value: any, save = true, refresh = true) {
    switch (identifier) {
      case "listenClipboard":
        this.setWatch(value);
        break;
      case "stayTop":
        if (this.win.window) {
          this.win.window.focus();
          this.win.window.setAlwaysOnTop(value);
        }
        break;
      case "skipTaskbar":
        this.win.setSkipTaskbar(value);
        break;
      case "incrementalCopy":
        this.clear();
        break;
      case "autoFormat":
        if (value) {
          this.set("autoCopy", false, save, refresh);
        }
        break;
      case "autoCopy":
        if (value) {
          this.set("autoFormat", false, save, refresh);
        }
        break;
      case "dragCopy":
        windowController.dragCopy = value;
        break;
      case "translatorType":
        this.translator = createTranslator(value);
        if (!isValid(this.translator, this.source())) {
          this.set("sourceLanguage", "en", save, refresh);
        }
        if (!isValid(this.translator, this.target())) {
          this.set("targetLanguage", "zh-CN", save, refresh);
        }
        this.doTranslate(this.src);
        break;
    }

    this.config.set(identifier, value);
    this.setCurrentColor();
    if (identifier == "localeSetting") {
      this.win.sendMsg(MessageType.UpdateT.toString(), null);
      // if (this.config) {
      //   this.action.update();
      // }
    }
    if (save) {
      this.config.saveValues(envConfig.configPath);
      if (refresh) {
        this.refresh();
      } else if (identifier == "autoFormat") {
        this.refresh("autoCopy");
      } else if (identifier == "autoCopy") {
        this.refresh("autoPurify");
      }
    }
  }
}

export { Controller };
