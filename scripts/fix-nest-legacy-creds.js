#!/usr/bin/env node
/**
 * Fix Nest Legacy credentials with proper encryption
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function encryptToken(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString('base64');
}

// Credentials from the browser
const issueTokenUrl = "https://accounts.google.com/o/oauth2/iframerpc?action=issueToken&response_type=token%20id_token&login_hint=AJDLj6LQu-SMCQLMJfOUep6S7tCeXh77UE3zhN297q1bzOUfVCsG0pnzP5W4Tua9mjMCPKzU8FP7yAIeItfWtmhxtQEEZVf65w&client_id=733249279899-44tchle2kaa9afr5v9ov7jbuojfr9lrq.apps.googleusercontent.com&origin=https%3A%2F%2Fhome.nest.com&scope=openid%20profile%20email%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fnest-account&ss_domain=https%3A%2F%2Fhome.nest.com&include_granted_scopes=true&auto=0&fedcm_enabled=true";

const cookies = "LSOLH=AH+1Ng1mzyx51himJs7NW2+KuMWcSXAeY4QhikkGapzPPGb3IXjCd5XzS8Ge4WV0M7bRE7xXIxAA9Sx0H5/ymzwiegzR7rWxsA==; __Secure-3PSID=g.a0005whtXwFEDmhykKUCloJ23onhPHFYYQlyXs_DPfmWg-R8Rb6W_fUuhqivo7vliN2XoLsWUgACgYKAdkSARQSFQHGX2MiU2Zt6e1vFlCQawf5yGq0TBoVAUF8yKpWmuS1ojKH62j6eChWnUwO0076; __Host-3PLSID=o.console.cloud.google.com|o.drive.google.com|o.myaccount.google.com:g.a0005whtX-92gZuWqA22X7YbYql6kIqM7sHRo4TBlpqpYt-x5V80O4DgAnUwbKV7ut4tcZJo4wACgYKAYwSARQSFQHGX2MipkIm-qvatEMRCTD3Y9XmWxoVAUF8yKouqgPIdtkGBg-EhzJfkzQ-0076; __Secure-3PAPISID=abfG1oMUIVDAqJ1X/AcB6Wn1cQqvse1v6q; NID=528=b_IjngjfHvNRR8AfQTmOff8JgbgMb_nwpjnENFtiLouQGYGmGEDobRjvRHGUG9OqU434XUUSoYfkegT5rIcliMT5tW1dtJtbu_0VDYAcM5cYaQ4aUbVrNFcqHWXcGy-vo3OJb2k8_tqG8kncbX8FMujZKo1sWcnzOAxzhdTJYwGk_R1Ip8M11LsrkFRWyxBu-KqKpehLC7Knrf3AkY6WpmGji9hMesXyc1GIlz-sWM1KtCLXwIuVGeIwOQoRmipgkhA4qamaScmhFATzjucFlAQFabJGHwf2TErc_UZp222c_JVI9fDvc-FXJWa4Q9LhngDROmtkSwtLg5XFj-fYwhCceFC_uuTn-_eQGLnik6Jdck7m0Yw8B48p8l0gMAtDtJtp2lwbER5NmtULLEUPWRXR7v5d7MhQPxFB9LAhegAI1hLHyspU2Tr0bVBKaxxkGGjE0EDNATGuISH1XP7BFvpvs6oof2ALgBPTkIx7ethls5c8uoQDsR85bsRfynYCx6qmQMXvuZdP-cxGVv6WYwD8UgDw42Xz3TFaP-etXLyU_X6O1pUrc7gtVWlbmkd-Grbecdb5OE7O5i_Bjw8zsKEtARXukz7dEjsnKatnSEH2Kv7xgUI2oP3E6oB8XE4Nlr7TTsptUlInuhZh_ToIhLQT7Af48BuqJfKCY8kURcXSLQjti1tSvE1M_odCsNc6QEME104P9moeAg0oeDXw7TUKZy6ZSUIxFZM5MX0CLKdCr76KGc5wT7uN9mWNPme-8026iRNT2DBONjw9HWWFfl74v6m-WiDJW3wXYKHNXKNMYKVPkaDHA5jTTLEvG_32HDvkPOXFJIPwu0ERTSwONJaNCAdCWXljyV3r04vRSnwJhsD2F71gzWtxRdfVZ6XO_VfvOojNYH_WlhUYaGA7fupeZ_vZM0hlOo5-flSmZN_MaFNcipuq3KkafiK4TftmfEWo-j1kaeGmqdCfllgkqbGIt2sN2zH6OgudpIk72RC4siLsnG9xpJNnn3stIko0FXKK_elPObIYmCYIheyvlzo4uXnVhpwGebiyRtyHL4Pih5tuELdY2rXhk8o4VSEF2E6L8c7tuCRzLiggCqWRxRtqaCubDqC30otFU9cbMJYFaAaIb7vO3bpL11PuTTrrine6jDorpf3RbjxymNCK0XUki8zmKubVYnuq4JKHlFZYTAGgg-XOOYPwa9NBstqft2dxzh53HoSlKC3Ll7VHNUfIaw6d9JXscsjR3Zwn7uC2BXjBsy5oUYVME3l9R_xXcPtzI6cpwC_Sz3OCuTEGtNnkwFaJOiE6ZazRWVgROJKlh8_dC8pKDOwCBc6aV3TOeIOJUwFarn6h7UPeGsg5iaF_rvNP1VxPwKTeKcdEzLooZH4HPn2TCUPiMfjVcnlOXey_uKZrk2D8DNqV_g; __Secure-3PSIDTS=sidts-CjEB7I_69JMEqJFHa0YmgLLJywuDx61nrwvHcmW2pe0YSQD5TE_abcXWnVPVuEM8-nIKEAA; __Secure-3PSIDCC=AKEyXzW9ojeN5dyfNI1w6PPLFwgTuEovLlBaem0YnZ_EllZ6JcnJ7rO7-_TMqs3s4r5VhzSaI6c";

// New format for auto-refresh (field names must match nest-legacy-refresh.ts)
const credentials = JSON.stringify({
  issue_token: issueTokenUrl,
  cookies,
});

const key = process.env.TOKEN_ENCRYPTION_KEY;
if (!key || key.length !== 64) {
  console.error('TOKEN_ENCRYPTION_KEY must be set (64 hex chars)');
  process.exit(1);
}

const encrypted = encryptToken(credentials, key);
console.log(encrypted);
