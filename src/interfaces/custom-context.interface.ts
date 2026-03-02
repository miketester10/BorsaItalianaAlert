import { Bot, CallbackQueryContext, MessageContext } from "gramio";

export interface MyMessageContext extends MessageContext<Bot> {}

export type MyCallbackQueryContext<Q = any> = Omit<CallbackQueryContext<Bot>, "data"> & { queryData: Q };

export const isCallbackContext = (ctx: MyMessageContext | MyCallbackQueryContext): ctx is MyCallbackQueryContext => {
  return !("reply" in ctx); // .reply() method is only available in MyMessageContext
};
