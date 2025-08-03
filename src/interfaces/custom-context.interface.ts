import { Bot, CallbackQueryShorthandContext, MessageContext } from "gramio";

export interface MyMessageContext extends MessageContext<Bot> {}
export interface MyCallbackQueryContext extends CallbackQueryShorthandContext<Bot, RegExp> {}