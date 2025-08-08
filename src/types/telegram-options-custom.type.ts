import { TelegramParams } from "gramio";

export type TelegramOptionsCustom = Partial<TelegramParams.SendMessageParams | TelegramParams.EditMessageTextParams>;
