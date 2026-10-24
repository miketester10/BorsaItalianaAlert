export enum AuthorizationAction {
  ADMIN_COMMAND = "comando [ /admin ]",
  KOFI_ALL_COMMAND = "comando [ /kofi_all ]",
  KOFI_USER_COMMAND = "comando [ /kofi_user ]",
  KOFI_NEW_USERS_COMMAND = "comando [ /kofi_new_users ]",
  MARK_KOFI_DONOR_COMMAND = "comando [ /mark_kofi_donor ]",
  CONFIRM_KOFI_ALL_CALLBACK = "callback [ confirmKofiAll ]",
  CONFIRM_KOFI_USER_CALLBACK = "callback [ confirmKofiUser ]",
  CONFIRM_KOFI_NEW_USERS_CALLBACK = "callback [ confirmKofiNewUsers ]",
  CONFIRM_MARK_KOFI_DONOR_CALLBACK = "callback [ confirmMarkKofiDonor ]",
}
