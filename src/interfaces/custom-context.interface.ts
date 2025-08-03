import { Bot, CallbackQueryShorthandContext, MessageContext } from "gramio";

export interface MyMessageContext extends MessageContext<Bot> {}
export interface MyCallbackQueryContext extends CallbackQueryShorthandContext<Bot, RegExp> {}

export const isCallbackContext = (ctx: MyMessageContext | MyCallbackQueryContext): ctx is MyCallbackQueryContext => {
  return !("reply" in ctx); // .reply() method is only available in MyMessageContext
};
