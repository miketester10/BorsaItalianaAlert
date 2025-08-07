import { TelegramParams } from "gramio";

export type TelegramOptions = Partial<TelegramParams.SendMessageParams | TelegramParams.EditMessageTextParams>;

export const isEditMessageOptions = (options: TelegramOptions | undefined): options is Partial<TelegramParams.EditMessageTextParams> => {
  return options !== undefined && Object.keys(options).length > 0;
};

export const isSendMessageOptions = (options: TelegramOptions | undefined): options is Partial<TelegramParams.SendMessageParams> => {
  return options !== undefined && Object.keys(options).length > 0;
};
