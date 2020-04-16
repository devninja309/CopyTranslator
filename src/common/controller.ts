import { Identifier, ActionView, MenuActionType } from "./types";
import { initConfig, ConfigParser } from "./configuration";
import { Promisified } from "@/proxy/renderer";
import { ActionManager } from "./action";

export abstract class CommonController {
  abstract action: ActionManager;
  get<T>(identifier: Identifier): T {
    return this.config.get(identifier) as T;
  }
  set(identifier: Identifier, value: any): boolean {
    return this.config.set(identifier, value);
  }
  switchValue(identifier: Identifier) {
    this.set(identifier, !this.get(identifier));
  }

  config: ConfigParser = initConfig();
}

export abstract class MainController extends CommonController {}

export abstract class RenController extends CommonController {
  abstract proxy: Promisified<MainController>;
}
