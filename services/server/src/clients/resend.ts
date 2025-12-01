import { Resend } from "resend";
import { config } from "../config";

export const resendClient = config.resendApiKey
	? new Resend(config.resendApiKey)
	: null;
