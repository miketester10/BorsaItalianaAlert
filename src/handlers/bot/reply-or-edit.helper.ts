import { FormattableString, TelegramParams } from "gramio";
import {
  isCallbackContext,
  MyCallbackQueryContext,
  MyMessageContext,
} from "../../types/custom-context.type";
import { TelegramOptionsCustom } from "../../types/telegram-options-custom.type";

export const replyOrEdit = async (
  ctx: MyMessageContext | MyCallbackQueryContext,
  text: string | FormattableString,
  options?: TelegramOptionsCustom,
): Promise<void> => {
  if (isCallbackContext(ctx)) {
    await ctx.editText(text, options as TelegramParams.EditMessageTextParams);
  } else {
    await ctx.reply(text, options);
  }
};
