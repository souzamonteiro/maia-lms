// Account email language follows the saved account locale, not the requester.
const messages = {
  en: {
    verify: ['Verify your Maia account', 'Verify your email:'],
    reset: ['Reset your Maia password', 'Reset your password:'],
    emailChange: ['Confirm your new Maia account email', 'Confirm your new email address:'],
  },
  'pt-BR': {
    verify: ['Verifique sua conta Maia', 'Verifique seu e-mail:'],
    reset: ['Recupere sua senha Maia', 'Redefina sua senha:'],
    emailChange: ['Confirme o novo e-mail da sua conta Maia', 'Confirme seu novo endereço de e-mail:'],
  },
  es: {
    verify: ['Verifica tu cuenta Maia', 'Verifica tu correo electrónico:'],
    reset: ['Restablece tu contraseña de Maia', 'Restablece tu contraseña:'],
    emailChange: ['Confirma el nuevo correo de tu cuenta Maia', 'Confirma tu nueva dirección de correo:'],
  },
};
export function accountMail(locale: string, kind: 'verify' | 'reset' | 'emailChange', url: string) {
  const language = locale === 'pt-BR' || locale === 'es' ? locale : 'en';
  const [subject, prompt] = messages[language][kind];
  return { subject, text: `${prompt} ${url}` };
}
