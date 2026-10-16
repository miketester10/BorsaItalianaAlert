import { Bot, CallbackQueryContext, MessageContext } from "gramio";

export type MyMessageContext = MessageContext<Bot>;
// Q = tipo di `queryData`: nei callback registrati con un CallbackData gramio lo inferisce
// da solo; il default `unknown` (non `any`) evita letture non tipizzate a chi usa il tipo nudo.
export type MyCallbackQueryContext<Q = unknown> = Omit<CallbackQueryContext<Bot>, "data"> & { queryData: Q };
export type MyGenericCallbackQueryContext = CallbackQueryContext<Bot>;
export type MyUserSourceContext = MyMessageContext | MyGenericCallbackQueryContext;

export const isCallbackContext = (ctx: MyMessageContext | MyCallbackQueryContext): ctx is MyCallbackQueryContext => {
  return !("reply" in ctx); // .reply() method is only available in MyMessageContext
};
