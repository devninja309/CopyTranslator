import { ConfigParser } from "./configParser";
import {
  Identifier,
  MenuActionType,
  Role,
  roles,
  layoutTypes,
  ActionView,
  compose,
  hideDirections,
  SubActionView,
  decompose,
  ActionInitOpt,
  colorModes,
  structActionTypes,
  translatorTypes,
  translatorGroups,
  Frequency,
} from "./types";
import { dictionaryTypes } from "./dictionary/types";
import { getLanguageLocales, Language } from "./translate/locale";
import store from "../store";
import bus from "../common/event-bus";
import logger from "./logger";

type Actions = Map<Identifier, ActionView>;

function subMenuGenerator(
  identifier: Identifier,
  list: Array<string>
): SubActionView[] {
  return list.map((e) => {
    const id = compose([identifier, e]);
    return {
      id,
      type: "checkbox",
      label: e,
    };
  });
}

const alias = new Map<string, string[]>([
  ["focus", ["layoutType|focus"]],
  ["contrast", ["layoutType|horizontal"]],
  ["simulateIncrementCopy", ["incrementSelect", "simulateCopy"]],
]);

//兼容旧版本的
const isMain = process.type == "browser";

class ActionManager {
  actions = new Map<Identifier, ActionView>();
  config: ConfigParser;
  constructor(config: ConfigParser) {
    this.config = config;
    bus.on("dispatch", (...args: any[]) => {
      this.dispatch(...args);
    });
  }

  dispatch(...args: any[]) {
    const { identifier, param } = decompose(...args);
    if (alias.get(identifier) != undefined) {
      for (const id of alias.get(identifier) as string[]) {
        this.dispatch(id);
      }
      return;
    }
    const action = this.getAction(identifier);
    bus.at("callback", {
      identifier,
      param,
      type: action.actionType,
      isMain,
    });
  }

  getAction(identifier: Identifier): ActionView {
    if (!this.actions.has(identifier)) {
      logger.toast(`动作 ${identifier} 不存在`);
    }
    const action = this.actions.get(identifier) as ActionView;
    if (action.subMenuGenerator) {
      action.submenu = action.subMenuGenerator();
    }
    return action;
  }

  append(action: ActionInitOpt) {
    if (!action.actionType) {
      action.actionType = action.type;
    }
    if (this.actions.has(action.id)) {
      throw "duplicated action id";
    }
    this.actions.set(action.id, action as ActionView);
  }

  init() {
    const config = this.config;
    //普通的按钮，执行一项操作
    function normalAction(id: Identifier): ActionInitOpt {
      return {
        type: "normal",
        id,
        tooltip: id,
      };
    }
    //原生角色
    function roleAction(role: Role): ActionInitOpt {
      return {
        role: role,
        id: role,
        type: "normal",
        tooltip: role,
      };
    }
    //设置常量
    function constantAction(identifier: Identifier): ActionInitOpt {
      return {
        actionType: "constant",
        id: identifier,
        tooltip: identifier,
      };
    }

    //切换状态的动作
    function switchAction(
      identifier: Identifier,
      freq: Frequency = "basic"
    ): ActionInitOpt {
      return {
        type: "checkbox",
        id: identifier,
        tooltip: config.getTooltip(identifier),
        freq: freq,
      };
    }

    //列表类型，是select的一种特化
    function listAction(identifier: Identifier, list: any): ActionInitOpt {
      return {
        type: "submenu",
        id: identifier,
        tooltip: config.getTooltip(identifier),
        submenu: subMenuGenerator(identifier, list),
      };
    }

    //自动生成子菜单
    function selectAction(
      identifier: Identifier,
      subMenuGenerator: () => Array<SubActionView>
    ): ActionInitOpt {
      return {
        type: "submenu",
        id: identifier,
        subMenuGenerator: subMenuGenerator,
        tooltip: config.getTooltip(identifier),
      };
    }

    function configAction(identifier: Identifier): ActionInitOpt {
      return {
        actionType: "config",
        id: identifier,
      };
    }

    function getLanguages(allowAuto: boolean = true): Language[] {
      return store.state.languages.filter((x) => {
        if (!allowAuto && x == "auto") {
          return false;
        }
        return true;
      });
    }

    function createLanguageGenerator(
      identifier: Identifier,
      allowAuto: boolean = true
    ): () => Array<SubActionView> {
      return () => {
        const l = getLanguageLocales(store.getters.localeSetting);
        return getLanguages(allowAuto).map((e) => {
          return {
            id: compose([identifier, e]),
            label: l[e],
            type: "checkbox",
          };
        });
      };
    }

    const localeGenerator = (id: Identifier) => {
      return () => {
        const locales = store.getters.locales.map((locale: any) => {
          return {
            id: compose([id, locale.lang]),
            label: locale.localeName,
            type: "checkbox",
          };
        });
        return locales;
      };
    };
    const delays = [
      0.0,
      0.1,
      0.2,
      0.3,
      0.3,
      0.4,
      0.5,
      0.6,
      0.7,
      0.8,
      0.9,
      1.0,
      1.5,
      2.0,
    ];

    this.append(listAction("hideDirect", hideDirections));
    this.append(listAction("translatorType", translatorTypes));
    this.append(listAction("dictionaryType", dictionaryTypes));
    this.append(listAction("layoutType", layoutTypes));
    this.append(listAction("colorMode", colorModes));

    this.append(switchAction("listenClipboard"));
    this.append(switchAction("dragCopy"));
    this.append(switchAction("autoCopy"));
    this.append(switchAction("autoPaste"));
    this.append(switchAction("autoFormat"));
    this.append(switchAction("autoPurify"));
    this.append(switchAction("incrementalCopy"));
    this.append(switchAction("autoHide"));
    this.append(switchAction("autoShow"));
    this.append(switchAction("stayTop"));
    this.append(switchAction("toastTip"));
    this.append(switchAction("doubleClickCopy"));
    this.append(switchAction("enableNotify"));
    this.append(switchAction("skipTaskbar"));
    this.append(switchAction("multiSource"));
    this.append(switchAction("enableDoubleCopyTranslate"));

    this.append(switchAction("openAtLogin", "advance"));
    this.append(switchAction("closeAsQuit", "advance"));
    this.append(switchAction("smartDict", "advance"));
    this.append(switchAction("contrastDict", "advance"));
    this.append(switchAction("smartTranslate", "advance"));
    this.append(switchAction("autoCheckUpdate", "advance"));
    this.append(switchAction("drawer", "advance"));

    this.append(normalAction("copySource"));
    this.append(normalAction("copyResult"));
    this.append(normalAction("pasteResult"));
    this.append(normalAction("clear"));
    this.append(normalAction("notify"));
    this.append(normalAction("toast"));
    this.append(normalAction("retryTranslate"));
    this.append(normalAction("focus"));
    this.append(normalAction("contrast"));
    this.append(normalAction("capture"));
    this.append(normalAction("restoreDefault"));
    this.append(normalAction("font+"));
    this.append(normalAction("font-"));
    this.append(normalAction("checkUpdate"));
    this.append(normalAction("translate"));
    this.append(normalAction("selectionQuery"));
    this.append(normalAction("hideWindow"));
    this.append(normalAction("closeWindow"));
    this.append(normalAction("showWindow"));
    this.append(normalAction("translateClipboard"));
    this.append(normalAction("doubleCopyTranslate"));
    this.append(normalAction("incrementSelect"));
    this.append(normalAction("simulateCopy"));
    this.append(normalAction("translateInput"));

    //引擎配置
    structActionTypes.forEach((id) => {
      this.append(configAction(id));
    });

    translatorGroups.forEach((id) => {
      this.append(configAction(id));
    });

    //role action
    roles.forEach((role) => {
      this.append(roleAction(role));
    });

    this.append(
      selectAction(
        "sourceLanguage",
        createLanguageGenerator("sourceLanguage", true)
      )
    );

    this.append(
      selectAction(
        "targetLanguage",
        createLanguageGenerator("targetLanguage", false)
      )
    );
    this.append(
      selectAction("localeSetting", localeGenerator("localeSetting"))
    );

    this.append(listAction("pasteDelay", delays));

    this.append(normalAction("settings"));
    this.append(normalAction("helpAndUpdate"));
    this.append(normalAction("exit"));
    this.append(normalAction("editConfigFile"));
    this.append(normalAction("showConfigFolder"));
  }

  getKeys(optionType: MenuActionType): Array<Identifier> {
    let contain: Array<Identifier> = [];
    const keys = Array.from(this.actions.keys());
    switch (optionType) {
      case "allActions":
        contain = keys;
        break;
      case "focusRight":
        contain = this.config.get("focusRight");
        break;
      case "contrastPanel":
        contain = this.config.get("contrastPanel");
        break;
      case "tray":
        contain = this.config.get("tray");
        break;
      case "options":
        contain = keys.filter(
          (x) => this.getAction(x).actionType === "submenu"
        );
        break;
      case "focusContext":
        contain = ["copy", "paste", "cut", "clear"];
        break;
      case "contrastContext":
        contain = ["copy", "paste", "cut", "clear", "copyResult", "copySource"];
        break;
      case "draggableOptions":
        contain = keys.filter(
          (x) => this.getAction(x).actionType !== "constant"
        );
      default:
        throw "wrong";
    }
    return contain.filter((key) => keys.includes(key));
  }

  getGroups(optionType: MenuActionType): { [freq: string]: Array<Identifier> } {
    let retval = {
      basic: Array<Identifier>(),
      advance: Array<Identifier>(),
    };
    const keys = Array.from(this.actions.keys());
    switch (optionType) {
      case "switches":
        for (const key of keys) {
          const action = this.getAction(key);
          if (action.actionType === "checkbox") {
            retval[action.freq as Frequency].push(key);
          }
        }
        retval["advance"].push("restoreDefault");
        break;
    }
    return retval;
  }
}

export { ActionManager };
