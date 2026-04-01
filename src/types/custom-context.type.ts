import { Bot, CallbackQueryContext, MessageContext } from "gramio";

export type MyMessageContext = MessageContext<Bot>;
export type MyCallbackQueryContext<Q = any> = Omit<CallbackQueryContext<Bot>, "data"> & { queryData: Q };
export type MyGenericCallbackQueryContext = CallbackQueryContext<Bot>;
export type MyUserSourceContext = MyMessageContext | MyGenericCallbackQueryContext;

export const isCallbackContext = (ctx: MyMessageContext | MyCallbackQueryContext): ctx is MyCallbackQueryContext => {
  return !("reply" in ctx); // .reply() method is only available in MyMessageContext
};
