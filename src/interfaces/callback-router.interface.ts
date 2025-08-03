import { MyCallbackQueryContext } from "./custom-context.interface";

export interface CallbackRouter {
  [key: string]: CallbackHandler;
}

type CallbackHandler = (ctx: MyCallbackQueryContext, payload: string) => Promise<void>;
