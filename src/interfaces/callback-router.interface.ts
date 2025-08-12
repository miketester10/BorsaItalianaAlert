import { CallbackAction } from "../enums/callback-action.enum";
import { CallbackPayload } from "../enums/callback-payload.enum";
import { MyCallbackQueryContext } from "./custom-context.interface";

export type CallbackRouter = Record<CallbackAction, CallbackHandler>;
type CallbackHandler = (ctx: MyCallbackQueryContext, payload: CallbackPayload) => Promise<void>;

export const isCallbackAction = (action: string | undefined): action is CallbackAction => {
  return action != undefined && (Object.values(CallbackAction) as string[]).includes(action);
};

export const isCallbackPayload = (payload: string | undefined): payload is CallbackPayload => {
  return payload != undefined && (Object.values(CallbackPayload) as string[]).includes(payload);
};
